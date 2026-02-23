'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  MAX_SHIFT_COVERAGE_PER_DAY,
  MAX_WORK_DAYS_PER_WEEK,
  MIN_SHIFT_COVERAGE_PER_DAY,
  getDefaultWeeklyLimitForEmploymentType,
  sanitizeWeeklyLimit,
} from '@/lib/scheduling-constants'
import {
  exceedsCoverageLimit,
  exceedsWeeklyLimit,
  summarizePublishWeeklyViolations,
  summarizeShiftSlotViolations,
} from '@/lib/schedule-rule-validation'
import { createClient } from '@/lib/supabase/server'
import { setDesignatedLeadMutation } from '@/lib/set-designated-lead'
import { notifyUsers } from '@/lib/notifications'
import { writeAuditLog } from '@/lib/audit-log'
import {
  buildDateRange,
  buildScheduleUrl,
  countsTowardWeeklyLimit,
  coverageSlotKey,
  getOne,
  getWeekBoundsForDate,
  pickTherapistForDate,
  weeklyCountKey,
} from '@/lib/schedule-helpers'
import type {
  AutoScheduleShiftRow,
  AvailabilityDateRow,
  Role,
  ShiftRole,
  ShiftLimitRow,
  ShiftStatus,
  Therapist,
} from '@/app/schedule/types'

const AUTO_GENERATE_TARGET_COVERAGE_PER_SHIFT = Math.min(
  MAX_SHIFT_COVERAGE_PER_DAY,
  Math.max(MIN_SHIFT_COVERAGE_PER_DAY, 4)
)

type ShiftPublishValidationRow = {
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  role: ShiftRole
  user_id: string
  profiles:
    | { full_name: string; is_lead_eligible: boolean }
    | { full_name: string; is_lead_eligible: boolean }[]
    | null
}

type CycleImportSourceRow = {
  id: string
  start_date: string
  end_date: string
}

type ImportedShiftRow = {
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  role: ShiftRole
}

function getPanelParam(formData: FormData): 'setup' | 'new-cycle' | 'add-shift' | undefined {
  const panel = String(formData.get('panel') ?? '').trim()
  if (panel === 'setup') return panel
  if (panel === 'new-cycle' || panel === 'add-shift') return panel
  return undefined
}

async function getRoleForUser(userId: string): Promise<Role> {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  return profile?.role === 'manager' ? 'manager' : 'therapist'
}

type TherapistWeeklyLimitProfile = {
  max_work_days_per_week: number | null
  employment_type: string | null
}

function getWeeklyLimitFromProfile(profile: TherapistWeeklyLimitProfile | null | undefined): number {
  const employmentDefault = getDefaultWeeklyLimitForEmploymentType(profile?.employment_type)
  return sanitizeWeeklyLimit(profile?.max_work_days_per_week, employmentDefault)
}

async function getTherapistWeeklyLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  therapistId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('max_work_days_per_week, employment_type')
    .eq('id', therapistId)
    .maybeSingle()

  if (error) return MAX_WORK_DAYS_PER_WEEK

  return getWeeklyLimitFromProfile((data ?? null) as TherapistWeeklyLimitProfile | null)
}

export async function createCycleAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (role !== 'manager') {
    redirect('/schedule')
  }

  const label = String(formData.get('label') ?? '').trim()
  const startDate = String(formData.get('start_date') ?? '').trim()
  const endDate = String(formData.get('end_date') ?? '').trim()
  const copyFromLastCycle = String(formData.get('copy_from_last_cycle') ?? '') === 'on'
  const publishedRequested = String(formData.get('published') ?? '') === 'on'
  const published = copyFromLastCycle ? false : publishedRequested
  const view = String(formData.get('view') ?? '').trim()
  const panel = getPanelParam(formData)
  const errorViewParams = panel ? { panel } : undefined

  if (!label || !startDate || !endDate) {
    redirect(buildScheduleUrl(undefined, view, { ...errorViewParams, error: 'create_cycle_failed' }))
  }

  const { data, error } = await supabase
    .from('schedule_cycles')
    .insert({
      label,
      start_date: startDate,
      end_date: endDate,
      published,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create schedule cycle:', error)
    redirect(buildScheduleUrl(undefined, view, { ...errorViewParams, error: 'create_cycle_failed' }))
  }

  if (copyFromLastCycle) {
    const [sourceCycleResult, importedShiftsResult] = await Promise.all([
      supabase
        .from('schedule_cycles')
        .select('id, start_date, end_date')
        .eq('published', true)
        .neq('id', data.id)
        .order('end_date', { ascending: false })
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('schedule_cycles')
        .select('id')
        .eq('id', data.id)
        .single(),
    ])

    if (sourceCycleResult.error || importedShiftsResult.error) {
      console.error('Failed to prepare import from previous cycle:', {
        sourceCycleError: sourceCycleResult.error,
        importedCycleError: importedShiftsResult.error,
      })
      revalidatePath('/schedule')
      redirect(buildScheduleUrl(data.id, view, { ...errorViewParams, error: 'copy_from_last_cycle_failed' }))
    }

    const sourceCycle = sourceCycleResult.data as CycleImportSourceRow | null
    if (sourceCycle) {
      const { data: sourceShiftsData, error: sourceShiftsError } = await supabase
        .from('shifts')
        .select('user_id, date, shift_type, status, role')
        .eq('cycle_id', sourceCycle.id)

      if (sourceShiftsError) {
        console.error('Failed to load source shifts for cycle import:', sourceShiftsError)
        revalidatePath('/schedule')
        redirect(buildScheduleUrl(data.id, view, { ...errorViewParams, error: 'copy_from_last_cycle_failed' }))
      }

      const sourceShifts = (sourceShiftsData ?? []) as ImportedShiftRow[]
      if (sourceShifts.length > 0) {
        const sourceDates = buildDateRange(sourceCycle.start_date, sourceCycle.end_date)
        const sourceIndexByDate = new Map(sourceDates.map((date, index) => [date, index]))
        const targetDates = buildDateRange(startDate, endDate)
        const sourceTherapistIds = Array.from(new Set(sourceShifts.map((shift) => shift.user_id)))

        const { data: eligibleProfilesData, error: eligibleProfilesError } = await supabase
          .from('profiles')
          .select('id')
          .in('id', sourceTherapistIds)
          .eq('role', 'therapist')
          .eq('is_active', true)
          .eq('on_fmla', false)

        if (eligibleProfilesError) {
          console.error('Failed to load eligible therapists for cycle import:', eligibleProfilesError)
          revalidatePath('/schedule')
          redirect(buildScheduleUrl(data.id, view, { ...errorViewParams, error: 'copy_from_last_cycle_failed' }))
        }

        const eligibleTherapistIds = new Set((eligibleProfilesData ?? []).map((row) => row.id as string))
        let skippedAssignments = 0
        const shiftsToInsert = sourceShifts
          .map((shift) => {
            if (!eligibleTherapistIds.has(shift.user_id)) {
              skippedAssignments += 1
              return null
            }

            const sourceIndex = sourceIndexByDate.get(shift.date)
            if (sourceIndex === undefined) {
              skippedAssignments += 1
              return null
            }

            const targetDate = targetDates[sourceIndex]
            if (!targetDate) {
              skippedAssignments += 1
              return null
            }

            return {
              cycle_id: data.id,
              user_id: shift.user_id,
              date: targetDate,
              shift_type: shift.shift_type,
              status: shift.status,
              role: shift.role,
            }
          })
          .filter((shift): shift is NonNullable<typeof shift> => Boolean(shift))

        let copiedAssignments = 0
        if (shiftsToInsert.length > 0) {
          const { data: insertedShifts, error: insertedShiftsError } = await supabase
            .from('shifts')
            .upsert(shiftsToInsert, { onConflict: 'cycle_id,user_id,date', ignoreDuplicates: true })
            .select('id')

          if (insertedShiftsError) {
            console.error('Failed to insert imported shifts:', insertedShiftsError)
            revalidatePath('/schedule')
            redirect(buildScheduleUrl(data.id, view, { ...errorViewParams, error: 'copy_from_last_cycle_failed' }))
          }

          copiedAssignments = insertedShifts?.length ?? 0
        }

        revalidatePath('/schedule')
        redirect(
          buildScheduleUrl(data.id, view, {
            success: 'cycle_created',
            copied: String(copiedAssignments),
            skipped: String(skippedAssignments),
          })
        )
      }
    }

    revalidatePath('/schedule')
    redirect(
      buildScheduleUrl(data.id, view, {
        success: 'cycle_created',
        copied: '0',
      })
    )
  }

  revalidatePath('/schedule')
  redirect(buildScheduleUrl(data.id, view, { success: 'cycle_created' }))
}

export async function toggleCyclePublishedAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (role !== 'manager') {
    redirect('/schedule')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const currentlyPublished = String(formData.get('currently_published') ?? '').trim() === 'true'
  const view = String(formData.get('view') ?? '').trim()
  const showUnavailable = String(formData.get('show_unavailable') ?? '').trim() === 'true'
  const overrideWeeklyRules = String(formData.get('override_weekly_rules') ?? '').trim() === 'true'
  const viewParams = showUnavailable ? { show_unavailable: 'true' } : undefined
  let publishCycleDetails: { label: string; startDate: string; endDate: string } | null = null

  if (!cycleId) {
    redirect(buildScheduleUrl(undefined, view, viewParams))
  }

  if (!currentlyPublished) {
    const { data: cycle, error: cycleError } = await supabase
      .from('schedule_cycles')
      .select('label, start_date, end_date')
      .eq('id', cycleId)
      .maybeSingle()

    if (cycleError || !cycle) {
      console.error('Failed to load cycle for publish validation:', cycleError)
      redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'publish_validation_failed' }))
    }
    publishCycleDetails = {
      label: cycle.label,
      startDate: cycle.start_date,
      endDate: cycle.end_date,
    }

    const cycleDates = buildDateRange(cycle.start_date, cycle.end_date)
    const cycleWeekDates = new Map<string, Set<string>>()
    const cycleWeekEnds = new Map<string, string>()
    for (const date of cycleDates) {
      const bounds = getWeekBoundsForDate(date)
      if (!bounds) continue
      const dates = cycleWeekDates.get(bounds.weekStart) ?? new Set<string>()
      dates.add(date)
      cycleWeekDates.set(bounds.weekStart, dates)
      cycleWeekEnds.set(bounds.weekStart, bounds.weekEnd)
    }

    if (!overrideWeeklyRules) {
      const { data: therapistsData, error: therapistsError } = await supabase
        .from('profiles')
        .select('id, max_work_days_per_week, employment_type')
        .eq('role', 'therapist')
        .eq('is_active', true)
        .eq('on_fmla', false)

      if (therapistsError) {
        console.error('Failed to load therapists for publish validation:', therapistsError)
        redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'publish_validation_failed' }))
      }

      const therapists = (therapistsData ?? []) as Array<{
        id: string
        max_work_days_per_week: number | null
        employment_type: string | null
      }>
      const therapistIds = therapists.map((row) => row.id)
      const maxWorkDaysByTherapist = new Map<string, number>(
        therapists.map((therapist) => [
          therapist.id,
          getWeeklyLimitFromProfile({
            max_work_days_per_week: therapist.max_work_days_per_week,
            employment_type: therapist.employment_type,
          }),
        ])
      )
      if (therapistIds.length > 0 && cycleWeekDates.size > 0) {
        const weekStarts = Array.from(cycleWeekDates.keys()).sort()
        const minWeekStart = weekStarts[0]
        const maxWeekEnd = cycleWeekEnds.get(weekStarts[weekStarts.length - 1]) ?? minWeekStart

        const { data: shiftsData, error: shiftsError } = await supabase
          .from('shifts')
          .select('user_id, date, status')
          .in('user_id', therapistIds)
          .gte('date', minWeekStart)
          .lte('date', maxWeekEnd)

        if (shiftsError) {
          console.error('Failed to load shifts for publish validation:', shiftsError)
          redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'publish_validation_failed' }))
        }

        const weeklyWorkedDatesByUserWeek = new Map<string, Set<string>>()
        for (const row of (shiftsData ?? []) as ShiftLimitRow[]) {
          if (!countsTowardWeeklyLimit(row.status)) continue
          const bounds = getWeekBoundsForDate(row.date)
          if (!bounds) continue
          const key = weeklyCountKey(row.user_id, bounds.weekStart)
          const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
          workedDates.add(row.date)
          weeklyWorkedDatesByUserWeek.set(key, workedDates)
        }

        const { underCount, overCount, violations } = summarizePublishWeeklyViolations({
          therapistIds,
          cycleWeekDates,
          weeklyWorkedDatesByUserWeek,
          maxWorkDaysByTherapist,
        })
        if (violations > 0) {
          redirect(
            buildScheduleUrl(cycleId, view, {
              ...viewParams,
              error: 'publish_weekly_rule_violation',
              violations: String(violations),
              under: String(underCount),
              over: String(overCount),
            })
          )
        }
      }
    }

    const { data: shiftCoverageData, error: shiftCoverageError } = await supabase
      .from('shifts')
      .select(
        'date, shift_type, status, role, user_id, profiles:profiles!shifts_user_id_fkey(full_name, is_lead_eligible)'
      )
      .eq('cycle_id', cycleId)
      .gte('date', cycle.start_date)
      .lte('date', cycle.end_date)

    if (shiftCoverageError) {
      console.error('Failed to load shifts for coverage validation:', shiftCoverageError)
      redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'publish_validation_failed' }))
    }

    const slotValidation = summarizeShiftSlotViolations({
      cycleDates,
      assignments: ((shiftCoverageData ?? []) as ShiftPublishValidationRow[]).map((row) => ({
        date: row.date,
        shiftType: row.shift_type,
        status: row.status,
        role: row.role,
        therapistId: row.user_id,
        therapistName: getOne(row.profiles)?.full_name ?? 'Unknown',
        isLeadEligible: Boolean(getOne(row.profiles)?.is_lead_eligible),
      })),
      minCoveragePerShift: MIN_SHIFT_COVERAGE_PER_DAY,
      maxCoveragePerShift: MAX_SHIFT_COVERAGE_PER_DAY,
    })

    if (slotValidation.violations > 0) {
      redirect(
        buildScheduleUrl(cycleId, view, {
          ...viewParams,
          error: 'publish_shift_rule_violation',
          under_coverage: String(slotValidation.underCoverage),
          over_coverage: String(slotValidation.overCoverage),
          lead_missing: String(slotValidation.missingLead),
          lead_multiple: String(slotValidation.multipleLeads),
          lead_ineligible: String(slotValidation.ineligibleLead),
        })
      )
    }
  }

  const { error } = await supabase
    .from('schedule_cycles')
    .update({ published: !currentlyPublished })
    .eq('id', cycleId)

  if (error) {
    console.error('Failed to toggle schedule publication state:', error)
  }

  if (!currentlyPublished && !error) {
    await writeAuditLog(supabase, {
      userId: user.id,
      action: 'cycle_published',
      targetType: 'schedule_cycle',
      targetId: cycleId,
    })

    const { data: therapistProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'therapist')
      .eq('is_active', true)

    const therapistIds = (therapistProfiles ?? []).map((profile) => profile.id as string)
    const cycleLabel = publishCycleDetails?.label ?? 'Schedule cycle'
    const cycleRange =
      publishCycleDetails
        ? `${publishCycleDetails.startDate} to ${publishCycleDetails.endDate}`
        : 'the current date range'

    await notifyUsers(supabase, {
      userIds: therapistIds,
      eventType: 'cycle_published',
      title: 'Cycle published',
      message: `${cycleLabel} (${cycleRange}) is now published.`,
      targetType: 'schedule_cycle',
      targetId: cycleId,
    })
  }

  revalidatePath('/schedule')
  redirect(
    buildScheduleUrl(cycleId, view, {
      ...viewParams,
      success: currentlyPublished ? 'cycle_unpublished' : 'cycle_published',
    })
  )
}

export async function addShiftAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (role !== 'manager') {
    redirect('/schedule')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const userId = String(formData.get('user_id') ?? '').trim()
  const date = String(formData.get('date') ?? '').trim()
  const shiftType = String(formData.get('shift_type') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()
  const view = String(formData.get('view') ?? '').trim()
  const showUnavailable = String(formData.get('show_unavailable') ?? '').trim() === 'true'
  const panel = getPanelParam(formData)
  const overrideWeeklyRules = String(formData.get('override_weekly_rules') ?? '').trim() === 'on'
  const viewParams = showUnavailable ? { show_unavailable: 'true' } : undefined
  const panelParams =
    panel === 'add-shift'
      ? {
          panel,
          add_date: date || undefined,
          add_shift_type: shiftType === 'night' ? 'night' : 'day',
        }
      : panel
        ? { panel }
        : undefined
  const errorViewParams = panelParams ? { ...viewParams, ...panelParams } : viewParams

  if (!cycleId || !userId || !date || !shiftType || !status) {
    redirect(buildScheduleUrl(undefined, view, errorViewParams))
  }

  const therapistWeeklyLimit =
    countsTowardWeeklyLimit(status) && !overrideWeeklyRules
      ? await getTherapistWeeklyLimit(supabase, userId)
      : MAX_WORK_DAYS_PER_WEEK

  if (countsTowardWeeklyLimit(status) && !overrideWeeklyRules) {
    const { data: sameSlotShifts, error: sameSlotError } = await supabase
      .from('shifts')
      .select('status')
      .eq('cycle_id', cycleId)
      .eq('date', date)
      .eq('shift_type', shiftType)

    if (sameSlotError) {
      console.error('Failed to load slot coverage for limit check:', sameSlotError)
      redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'add_shift_failed' }))
    }

    const activeCoverage = (sameSlotShifts ?? []).filter((row) => countsTowardWeeklyLimit(row.status)).length
    if (exceedsCoverageLimit(activeCoverage, MAX_SHIFT_COVERAGE_PER_DAY)) {
      redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'coverage_max_exceeded' }))
    }
  }

  if (countsTowardWeeklyLimit(status) && !overrideWeeklyRules) {
    const bounds = getWeekBoundsForDate(date)
    if (!bounds) {
      redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'add_shift_failed' }))
    }

    const { data: weeklyShiftsData, error: weeklyShiftsError } = await supabase
      .from('shifts')
      .select('date, status')
      .eq('user_id', userId)
      .gte('date', bounds.weekStart)
      .lte('date', bounds.weekEnd)

    if (weeklyShiftsError) {
      console.error('Failed to load weekly shifts for limit check:', weeklyShiftsError)
      redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'add_shift_failed' }))
    }

    const workedDates = new Set<string>()
    for (const row of (weeklyShiftsData ?? []) as Array<{ date: string; status: ShiftStatus }>) {
      if (!countsTowardWeeklyLimit(row.status)) continue
      workedDates.add(row.date)
    }

    if (exceedsWeeklyLimit(workedDates, date, therapistWeeklyLimit)) {
      redirect(
        buildScheduleUrl(cycleId, view, {
          ...errorViewParams,
          error: 'weekly_limit_exceeded',
          week_start: bounds.weekStart,
          week_end: bounds.weekEnd,
        })
      )
    }
  }

  const { data: insertedShift, error } = await supabase
    .from('shifts')
    .insert({
      cycle_id: cycleId,
      user_id: userId,
      date,
      shift_type: shiftType,
      status,
      role: 'staff',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to insert shift:', error)
    if (error.code === '23505') {
      redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'duplicate_shift' }))
    }
    redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'add_shift_failed' }))
  }

  if (insertedShift?.id) {
    await writeAuditLog(supabase, {
      userId: user.id,
      action: 'shift_added',
      targetType: 'shift',
      targetId: insertedShift.id,
    })
  }

  await notifyUsers(supabase, {
    userIds: [userId],
    eventType: 'shift_assigned',
    title: 'New shift assigned',
    message: `You were assigned a ${shiftType} shift on ${date}.`,
    targetType: 'shift',
    targetId: insertedShift?.id ?? `${cycleId}:${userId}:${date}`,
  })

  revalidatePath('/schedule')
  redirect(buildScheduleUrl(cycleId, view, { ...viewParams, success: 'shift_added' }))
}

export async function generateDraftScheduleAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (role !== 'manager') {
    redirect('/schedule')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const view = String(formData.get('view') ?? '').trim()
  const showUnavailable = String(formData.get('show_unavailable') ?? '').trim() === 'true'
  const viewParams = showUnavailable ? { show_unavailable: 'true' } : undefined

  if (!cycleId) {
    redirect(buildScheduleUrl(undefined, view, { ...viewParams, error: 'auto_missing_cycle' }))
  }

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, start_date, end_date, published')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    console.error('Failed to load cycle for auto-generation:', cycleError)
    redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'auto_generate_failed' }))
  }

  if (cycle.published) {
    redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'auto_cycle_published' }))
  }

  const { data: therapistsData, error: therapistsError } = await supabase
    .from('profiles')
    .select(
      'id, full_name, shift_type, is_lead_eligible, employment_type, max_work_days_per_week, preferred_work_days, on_fmla, fmla_return_date, is_active'
    )
    .eq('role', 'therapist')
    .eq('is_active', true)
    .eq('on_fmla', false)
    .order('full_name', { ascending: true })

  if (therapistsError) {
    console.error('Failed to load therapists for auto-generation:', therapistsError)
    redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'auto_generate_failed' }))
  }

  const therapists = ((therapistsData ?? []) as Therapist[]).map((therapist) => ({
    ...therapist,
    preferred_work_days: Array.isArray(therapist.preferred_work_days)
      ? therapist.preferred_work_days
          .map((day) => Number(day))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : [],
  }))
  const weeklyLimitByTherapist = new Map<string, number>(
    therapists.map((therapist) => [
      therapist.id,
      sanitizeWeeklyLimit(
        therapist.max_work_days_per_week,
        getDefaultWeeklyLimitForEmploymentType(therapist.employment_type)
      ),
    ])
  )
  if (therapists.length === 0) {
    redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'auto_no_therapists' }))
  }

  const cycleDates = buildDateRange(cycle.start_date, cycle.end_date)
  if (cycleDates.length === 0) {
    redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'auto_generate_failed' }))
  }

  const firstWeekBounds = getWeekBoundsForDate(cycle.start_date)
  const lastWeekBounds = getWeekBoundsForDate(cycle.end_date)
  if (!firstWeekBounds || !lastWeekBounds) {
    redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'auto_generate_failed' }))
  }

  const therapistIds = therapists.map((therapist) => therapist.id)

  const [existingShiftsResult, cycleAvailabilityResult, globalAvailabilityResult, weeklyShiftsResult] =
    await Promise.all([
      supabase
        .from('shifts')
        .select('user_id, date, shift_type, status, role')
        .eq('cycle_id', cycleId),
      supabase
        .from('availability_requests')
        .select('user_id, date')
        .eq('cycle_id', cycleId)
        .gte('date', cycle.start_date)
        .lte('date', cycle.end_date),
      supabase
        .from('availability_requests')
        .select('user_id, date')
        .is('cycle_id', null)
        .gte('date', cycle.start_date)
        .lte('date', cycle.end_date),
      supabase
        .from('shifts')
        .select('user_id, date, status')
        .in('user_id', therapistIds)
        .gte('date', firstWeekBounds.weekStart)
        .lte('date', lastWeekBounds.weekEnd),
    ])

  if (
    existingShiftsResult.error ||
    cycleAvailabilityResult.error ||
    globalAvailabilityResult.error ||
    weeklyShiftsResult.error
  ) {
    console.error('Failed to load scheduling data for auto-generation:', {
      existingShiftsError: existingShiftsResult.error,
      cycleAvailabilityError: cycleAvailabilityResult.error,
      globalAvailabilityError: globalAvailabilityResult.error,
      weeklyShiftsError: weeklyShiftsResult.error,
    })
    redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'auto_generate_failed' }))
  }

  const existingShifts = (existingShiftsResult.data ?? []) as AutoScheduleShiftRow[]
  const blockedRows = [
    ...((cycleAvailabilityResult.data ?? []) as AvailabilityDateRow[]),
    ...((globalAvailabilityResult.data ?? []) as AvailabilityDateRow[]),
  ]

  const unavailableDatesByUser = new Map<string, Set<string>>()
  for (const row of blockedRows) {
    const unavailableDates = unavailableDatesByUser.get(row.user_id) ?? new Set<string>()
    unavailableDates.add(row.date)
    unavailableDatesByUser.set(row.user_id, unavailableDates)
  }

  const weeklyWorkedDatesByUserWeek = new Map<string, Set<string>>()
  for (const row of (weeklyShiftsResult.data ?? []) as ShiftLimitRow[]) {
    if (!countsTowardWeeklyLimit(row.status)) continue
    const bounds = getWeekBoundsForDate(row.date)
    if (!bounds) continue

    const key = weeklyCountKey(row.user_id, bounds.weekStart)
    const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
    workedDates.add(row.date)
    weeklyWorkedDatesByUserWeek.set(key, workedDates)
  }

  const coverageBySlot = new Map<string, number>()
  const assignedUserIdsByDate = new Map<string, Set<string>>()
  const leadAssignedBySlot = new Map<string, boolean>()
  const shiftsBySlot = new Map<string, AutoScheduleShiftRow[]>()
  const therapistById = new Map(therapists.map((therapist) => [therapist.id, therapist]))
  for (const shift of existingShifts) {
    const slotKey = coverageSlotKey(shift.date, shift.shift_type)
    const slotShifts = shiftsBySlot.get(slotKey) ?? []
    slotShifts.push(shift)
    shiftsBySlot.set(slotKey, slotShifts)

    if (shift.role === 'lead') {
      leadAssignedBySlot.set(slotKey, true)
    }

    if (countsTowardWeeklyLimit(shift.status)) {
      const coverage = coverageBySlot.get(slotKey) ?? 0
      coverageBySlot.set(slotKey, coverage + 1)
    }
    const assignedForDate = assignedUserIdsByDate.get(shift.date) ?? new Set<string>()
    assignedForDate.add(shift.user_id)
    assignedUserIdsByDate.set(shift.date, assignedForDate)
  }

  const dayTherapists = therapists.filter((therapist) => therapist.shift_type === 'day')
  const nightTherapists = therapists.filter((therapist) => therapist.shift_type === 'night')
  const dayLeadTherapists = dayTherapists.filter((therapist) => therapist.is_lead_eligible)
  const nightLeadTherapists = nightTherapists.filter((therapist) => therapist.is_lead_eligible)

  let dayCursor = 0
  let nightCursor = 0
  let dayLeadCursor = 0
  let nightLeadCursor = 0
  let unfilledSlots = 0
  let missingLeadSlots = 0
  const pendingLeadUpdates: Array<{ date: string; shiftType: 'day' | 'night'; therapistId: string }> = []

  const draftShiftsToInsert: Array<{
    cycle_id: string
    user_id: string
    date: string
    shift_type: 'day' | 'night'
    status: 'scheduled'
    role: ShiftRole
  }> = []

  for (const date of cycleDates) {
    const assignedForDate = assignedUserIdsByDate.get(date) ?? new Set<string>()
    assignedUserIdsByDate.set(date, assignedForDate)

    const daySlotKey = coverageSlotKey(date, 'day')
    let dayCoverage = coverageBySlot.get(daySlotKey) ?? 0
    let dayHasLead = leadAssignedBySlot.get(daySlotKey) === true

    if (!dayHasLead) {
      const existingDayLeadCandidate = (shiftsBySlot.get(daySlotKey) ?? []).find((shift) => {
        if (!countsTowardWeeklyLimit(shift.status)) return false
        return therapistById.get(shift.user_id)?.is_lead_eligible === true
      })
      if (existingDayLeadCandidate) {
        pendingLeadUpdates.push({
          date,
          shiftType: 'day',
          therapistId: existingDayLeadCandidate.user_id,
        })
        dayHasLead = true
        leadAssignedBySlot.set(daySlotKey, true)
      }
    }

    if (!dayHasLead) {
      const dayLeadPick = pickTherapistForDate(
        dayLeadTherapists,
        dayLeadCursor,
        date,
        unavailableDatesByUser,
        assignedForDate,
        weeklyWorkedDatesByUserWeek,
        weeklyLimitByTherapist
      )
      dayLeadCursor = dayLeadPick.nextCursor

      if (dayLeadPick.therapist) {
        draftShiftsToInsert.push({
          cycle_id: cycleId,
          user_id: dayLeadPick.therapist.id,
          date,
          shift_type: 'day',
          status: 'scheduled',
          role: 'lead',
        })
        assignedForDate.add(dayLeadPick.therapist.id)
        const weekBounds = getWeekBoundsForDate(date)
        if (weekBounds) {
          const key = weeklyCountKey(dayLeadPick.therapist.id, weekBounds.weekStart)
          const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
          workedDates.add(date)
          weeklyWorkedDatesByUserWeek.set(key, workedDates)
        }
        dayCoverage += 1
        coverageBySlot.set(daySlotKey, dayCoverage)
        dayHasLead = true
        leadAssignedBySlot.set(daySlotKey, true)
      }
    }

    while (dayCoverage < AUTO_GENERATE_TARGET_COVERAGE_PER_SHIFT) {
      const dayPick = pickTherapistForDate(
        dayTherapists,
        dayCursor,
        date,
        unavailableDatesByUser,
        assignedForDate,
        weeklyWorkedDatesByUserWeek,
        weeklyLimitByTherapist
      )
      dayCursor = dayPick.nextCursor

      if (dayPick.therapist) {
        const roleForDayShift: ShiftRole =
          !dayHasLead && dayPick.therapist.is_lead_eligible ? 'lead' : 'staff'
        draftShiftsToInsert.push({
          cycle_id: cycleId,
          user_id: dayPick.therapist.id,
          date,
          shift_type: 'day',
          status: 'scheduled',
          role: roleForDayShift,
        })
        assignedForDate.add(dayPick.therapist.id)
        const weekBounds = getWeekBoundsForDate(date)
        if (weekBounds) {
          const key = weeklyCountKey(dayPick.therapist.id, weekBounds.weekStart)
          const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
          workedDates.add(date)
          weeklyWorkedDatesByUserWeek.set(key, workedDates)
        }
        dayCoverage += 1
        coverageBySlot.set(daySlotKey, dayCoverage)
        if (roleForDayShift === 'lead') {
          dayHasLead = true
          leadAssignedBySlot.set(daySlotKey, true)
        }
      } else {
        if (dayCoverage < MIN_SHIFT_COVERAGE_PER_DAY) {
          unfilledSlots += MIN_SHIFT_COVERAGE_PER_DAY - dayCoverage
        }
        break
      }
    }

    if (!dayHasLead) {
      missingLeadSlots += 1
    }

    const nightSlotKey = coverageSlotKey(date, 'night')
    let nightCoverage = coverageBySlot.get(nightSlotKey) ?? 0
    let nightHasLead = leadAssignedBySlot.get(nightSlotKey) === true

    if (!nightHasLead) {
      const existingNightLeadCandidate = (shiftsBySlot.get(nightSlotKey) ?? []).find((shift) => {
        if (!countsTowardWeeklyLimit(shift.status)) return false
        return therapistById.get(shift.user_id)?.is_lead_eligible === true
      })
      if (existingNightLeadCandidate) {
        pendingLeadUpdates.push({
          date,
          shiftType: 'night',
          therapistId: existingNightLeadCandidate.user_id,
        })
        nightHasLead = true
        leadAssignedBySlot.set(nightSlotKey, true)
      }
    }

    if (!nightHasLead) {
      const nightLeadPick = pickTherapistForDate(
        nightLeadTherapists,
        nightLeadCursor,
        date,
        unavailableDatesByUser,
        assignedForDate,
        weeklyWorkedDatesByUserWeek,
        weeklyLimitByTherapist
      )
      nightLeadCursor = nightLeadPick.nextCursor

      if (nightLeadPick.therapist) {
        draftShiftsToInsert.push({
          cycle_id: cycleId,
          user_id: nightLeadPick.therapist.id,
          date,
          shift_type: 'night',
          status: 'scheduled',
          role: 'lead',
        })
        assignedForDate.add(nightLeadPick.therapist.id)
        const weekBounds = getWeekBoundsForDate(date)
        if (weekBounds) {
          const key = weeklyCountKey(nightLeadPick.therapist.id, weekBounds.weekStart)
          const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
          workedDates.add(date)
          weeklyWorkedDatesByUserWeek.set(key, workedDates)
        }
        nightCoverage += 1
        coverageBySlot.set(nightSlotKey, nightCoverage)
        nightHasLead = true
        leadAssignedBySlot.set(nightSlotKey, true)
      }
    }

    while (nightCoverage < AUTO_GENERATE_TARGET_COVERAGE_PER_SHIFT) {
      const nightPick = pickTherapistForDate(
        nightTherapists,
        nightCursor,
        date,
        unavailableDatesByUser,
        assignedForDate,
        weeklyWorkedDatesByUserWeek,
        weeklyLimitByTherapist
      )
      nightCursor = nightPick.nextCursor

      if (nightPick.therapist) {
        const roleForNightShift: ShiftRole =
          !nightHasLead && nightPick.therapist.is_lead_eligible ? 'lead' : 'staff'
        draftShiftsToInsert.push({
          cycle_id: cycleId,
          user_id: nightPick.therapist.id,
          date,
          shift_type: 'night',
          status: 'scheduled',
          role: roleForNightShift,
        })
        assignedForDate.add(nightPick.therapist.id)
        const weekBounds = getWeekBoundsForDate(date)
        if (weekBounds) {
          const key = weeklyCountKey(nightPick.therapist.id, weekBounds.weekStart)
          const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
          workedDates.add(date)
          weeklyWorkedDatesByUserWeek.set(key, workedDates)
        }
        nightCoverage += 1
        coverageBySlot.set(nightSlotKey, nightCoverage)
        if (roleForNightShift === 'lead') {
          nightHasLead = true
          leadAssignedBySlot.set(nightSlotKey, true)
        }
      } else {
        if (nightCoverage < MIN_SHIFT_COVERAGE_PER_DAY) {
          unfilledSlots += MIN_SHIFT_COVERAGE_PER_DAY - nightCoverage
        }
        break
      }
    }

    if (!nightHasLead) {
      missingLeadSlots += 1
    }
  }

  if (draftShiftsToInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('shifts')
      .upsert(draftShiftsToInsert, { onConflict: 'cycle_id,user_id,date', ignoreDuplicates: true })
      .select('id')

    if (insertError) {
      console.error('Failed to insert auto-generated shifts:', insertError)
      redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'auto_generate_db_error' }))
    }

    const silentlyDropped = draftShiftsToInsert.length - (inserted?.length ?? 0)
    if (silentlyDropped > 0) {
      console.warn(`Auto-generate: ${silentlyDropped} shift(s) skipped due to concurrent conflicts.`)
      redirect(
        buildScheduleUrl(cycleId, view, {
          ...viewParams,
          error: 'auto_generate_coverage_incomplete',
          dropped: String(silentlyDropped),
        })
      )
    }
  }

  if (pendingLeadUpdates.length > 0) {
    for (const update of pendingLeadUpdates) {
      const leadResult = await setDesignatedLeadMutation(supabase, {
        cycleId,
        therapistId: update.therapistId,
        date: update.date,
        shiftType: update.shiftType,
      })
      if (!leadResult.ok) {
        console.error('Auto-generate failed to designate lead for slot:', update, leadResult.error)
        redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'auto_generate_lead_assignment_failed' }))
      }
    }
  }

  revalidatePath('/schedule')
  redirect(
    buildScheduleUrl(cycleId, view, {
      ...viewParams,
      auto: 'generated',
      added: String(draftShiftsToInsert.length),
      unfilled: String(unfilledSlots),
      lead_missing: String(missingLeadSlots),
    })
  )
}

export async function resetDraftScheduleAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (role !== 'manager') {
    redirect('/schedule')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const view = String(formData.get('view') ?? '').trim()
  const showUnavailable = String(formData.get('show_unavailable') ?? '').trim() === 'true'
  const viewParams = showUnavailable ? { show_unavailable: 'true' } : undefined

  if (!cycleId) {
    redirect(buildScheduleUrl(undefined, view, { ...viewParams, error: 'reset_missing_cycle' }))
  }

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, published')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    console.error('Failed to load cycle for reset:', cycleError)
    redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'reset_failed' }))
  }

  if (cycle.published) {
    redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'reset_cycle_published' }))
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from('shifts')
    .delete()
    .eq('cycle_id', cycleId)
    .select('id')

  if (deleteError) {
    console.error('Failed to reset draft shifts:', deleteError)
    redirect(buildScheduleUrl(cycleId, view, { ...viewParams, error: 'reset_failed' }))
  }

  const removedCount = deletedRows?.length ?? 0

  revalidatePath('/schedule')
  redirect(
    buildScheduleUrl(cycleId, view, {
      ...viewParams,
      draft: 'reset',
      removed: String(removedCount),
    })
  )
}

export async function deleteShiftAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (role !== 'manager') {
    redirect('/schedule')
  }

  const shiftId = String(formData.get('shift_id') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const view = String(formData.get('view') ?? '').trim()

  if (!shiftId || !cycleId) {
    redirect('/schedule?error=delete_shift_failed')
  }

  const { error } = await supabase.from('shifts').delete().eq('id', shiftId)
  if (error) {
    console.error('Failed to delete shift:', error)
    redirect(buildScheduleUrl(cycleId, view, { error: 'delete_shift_failed' }))
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'shift_removed',
    targetType: 'shift',
    targetId: shiftId,
  })

  revalidatePath('/schedule')
  redirect(buildScheduleUrl(cycleId, view, { success: 'shift_deleted' }))
}

export async function setDesignatedLeadAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (role !== 'manager') {
    redirect('/schedule')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const therapistId = String(formData.get('therapist_id') ?? '').trim()
  const date = String(formData.get('date') ?? '').trim()
  const shiftType = String(formData.get('shift_type') ?? '').trim() as 'day' | 'night'
  const view = String(formData.get('view') ?? '').trim()
  const showUnavailable = String(formData.get('show_unavailable') ?? '').trim() === 'true'
  const panel = getPanelParam(formData)
  const viewParams = showUnavailable ? { show_unavailable: 'true' } : undefined
  const panelParams =
    panel === 'add-shift'
      ? {
          panel,
          add_date: date || undefined,
          add_shift_type: shiftType === 'night' ? 'night' : 'day',
        }
      : panel
        ? { panel }
        : undefined
  const errorViewParams = panelParams ? { ...viewParams, ...panelParams } : viewParams

  if (!cycleId || !therapistId || !date || (shiftType !== 'day' && shiftType !== 'night')) {
    redirect(buildScheduleUrl(cycleId || undefined, view, { ...errorViewParams, error: 'set_lead_failed' }))
  }

  const { data: therapist, error: therapistError } = await supabase
    .from('profiles')
    .select('id, role, is_lead_eligible, max_work_days_per_week, employment_type')
    .eq('id', therapistId)
    .maybeSingle()

  if (therapistError || !therapist || therapist.role !== 'therapist' || !therapist.is_lead_eligible) {
    redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_not_eligible' }))
  }

  const therapistWeeklyLimit = getWeeklyLimitFromProfile({
    max_work_days_per_week: therapist.max_work_days_per_week,
    employment_type: therapist.employment_type,
  })

  const { data: existingShift, error: existingShiftError } = await supabase
    .from('shifts')
    .select('id, status')
    .eq('cycle_id', cycleId)
    .eq('user_id', therapistId)
    .eq('date', date)
    .eq('shift_type', shiftType)
    .maybeSingle()

  if (existingShiftError) {
    console.error('Failed to load existing shift for designated lead action:', existingShiftError)
    redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_failed' }))
  }

  if (!existingShift) {
    const { data: sameSlotShifts, error: sameSlotError } = await supabase
      .from('shifts')
      .select('status')
      .eq('cycle_id', cycleId)
      .eq('date', date)
      .eq('shift_type', shiftType)

    if (sameSlotError) {
      console.error('Failed to load slot coverage for designated lead action:', sameSlotError)
      redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_failed' }))
    }

    const activeCoverage = (sameSlotShifts ?? []).filter((row) => countsTowardWeeklyLimit(row.status)).length
    if (exceedsCoverageLimit(activeCoverage, MAX_SHIFT_COVERAGE_PER_DAY)) {
      redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_coverage_max' }))
    }

    const bounds = getWeekBoundsForDate(date)
    if (!bounds) {
      redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_failed' }))
    }

    const { data: weeklyShiftsData, error: weeklyShiftsError } = await supabase
      .from('shifts')
      .select('date, status')
      .eq('user_id', therapistId)
      .gte('date', bounds.weekStart)
      .lte('date', bounds.weekEnd)

    if (weeklyShiftsError) {
      console.error('Failed to load weekly shifts for designated lead action:', weeklyShiftsError)
      redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_failed' }))
    }

    const workedDates = new Set<string>()
    for (const row of (weeklyShiftsData ?? []) as Array<{ date: string; status: ShiftStatus }>) {
      if (!countsTowardWeeklyLimit(row.status)) continue
      workedDates.add(row.date)
    }

    if (exceedsWeeklyLimit(workedDates, date, therapistWeeklyLimit)) {
      redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_weekly_limit' }))
    }
  }

  const mutationResult = await setDesignatedLeadMutation(supabase, {
    cycleId,
    therapistId,
    date,
    shiftType,
  })

  if (!mutationResult.ok) {
    if (mutationResult.reason === 'lead_not_eligible') {
      redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_not_eligible' }))
    }
    if (mutationResult.reason === 'multiple_leads_prevented') {
      redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_multiple' }))
    }
    redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_failed' }))
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'designated_lead_assigned',
    targetType: 'shift_slot',
    targetId: `${cycleId}:${date}:${shiftType}`,
  })

  revalidatePath('/schedule')
  redirect(buildScheduleUrl(cycleId, view, { ...viewParams, success: 'lead_updated' }))
}
