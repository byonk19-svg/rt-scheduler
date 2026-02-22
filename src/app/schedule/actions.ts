'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  MAX_SHIFT_COVERAGE_PER_DAY,
  MAX_WORK_DAYS_PER_WEEK,
  MIN_SHIFT_COVERAGE_PER_DAY,
} from '@/lib/scheduling-constants'
import {
  exceedsCoverageLimit,
  exceedsWeeklyLimit,
  summarizePublishWeeklyViolations,
  summarizeShiftSlotViolations,
} from '@/lib/schedule-rule-validation'
import { createClient } from '@/lib/supabase/server'
import { setDesignatedLeadMutation } from '@/lib/set-designated-lead'
import {
  buildDateRange,
  buildScheduleUrl,
  countsTowardWeeklyLimit,
  coverageSlotKey,
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

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

async function getRoleForUser(userId: string): Promise<Role> {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  return profile?.role === 'manager' ? 'manager' : 'therapist'
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
  const published = String(formData.get('published') ?? '') === 'on'
  const view = String(formData.get('view') ?? '').trim()

  if (!label || !startDate || !endDate) {
    redirect('/schedule')
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
    redirect('/schedule')
  }

  revalidatePath('/schedule')
  redirect(buildScheduleUrl(data.id, view))
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
  const overrideWeeklyRules = String(formData.get('override_weekly_rules') ?? '').trim() === 'true'

  if (!cycleId) {
    redirect('/schedule')
  }

  if (!currentlyPublished) {
    const { data: cycle, error: cycleError } = await supabase
      .from('schedule_cycles')
      .select('start_date, end_date')
      .eq('id', cycleId)
      .maybeSingle()

    if (cycleError || !cycle) {
      console.error('Failed to load cycle for publish validation:', cycleError)
      redirect(buildScheduleUrl(cycleId, view, { error: 'publish_validation_failed' }))
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
        .select('id')
        .eq('role', 'therapist')

      if (therapistsError) {
        console.error('Failed to load therapists for publish validation:', therapistsError)
        redirect(buildScheduleUrl(cycleId, view, { error: 'publish_validation_failed' }))
      }

      const therapistIds = (therapistsData ?? []).map((row) => row.id)
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
          redirect(buildScheduleUrl(cycleId, view, { error: 'publish_validation_failed' }))
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
          maxWorkDaysPerWeek: MAX_WORK_DAYS_PER_WEEK,
        })
        if (violations > 0) {
          redirect(
            buildScheduleUrl(cycleId, view, {
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
      .select('date, shift_type, status, role, user_id, profiles(full_name, is_lead_eligible)')
      .eq('cycle_id', cycleId)
      .gte('date', cycle.start_date)
      .lte('date', cycle.end_date)

    if (shiftCoverageError) {
      console.error('Failed to load shifts for coverage validation:', shiftCoverageError)
      redirect(buildScheduleUrl(cycleId, view, { error: 'publish_validation_failed' }))
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
      const affectedList = slotValidation.issues
        .slice(0, 8)
        .map((issue) => `${issue.date} ${issue.shiftType}`)
        .join(', ')
      const truncatedCount = Math.max(slotValidation.issues.length - 8, 0)
      const affectedSummary =
        truncatedCount > 0 ? `${affectedList}, +${truncatedCount} more` : affectedList

      redirect(
        buildScheduleUrl(cycleId, view, {
          error: 'publish_shift_rule_violation',
          under_coverage: String(slotValidation.underCoverage),
          over_coverage: String(slotValidation.overCoverage),
          lead_missing: String(slotValidation.missingLead),
          lead_multiple: String(slotValidation.multipleLeads),
          lead_ineligible: String(slotValidation.ineligibleLead),
          affected: affectedSummary || undefined,
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

  revalidatePath('/schedule')
  redirect(buildScheduleUrl(cycleId, view))
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
  const overrideWeeklyRules = String(formData.get('override_weekly_rules') ?? '').trim() === 'on'

  if (!cycleId || !userId || !date || !shiftType || !status) {
    redirect('/schedule')
  }

  if (countsTowardWeeklyLimit(status) && !overrideWeeklyRules) {
    const { data: sameSlotShifts, error: sameSlotError } = await supabase
      .from('shifts')
      .select('status')
      .eq('cycle_id', cycleId)
      .eq('date', date)
      .eq('shift_type', shiftType)

    if (sameSlotError) {
      console.error('Failed to load slot coverage for limit check:', sameSlotError)
      redirect(buildScheduleUrl(cycleId, view, { error: 'add_shift_failed' }))
    }

    const activeCoverage = (sameSlotShifts ?? []).filter((row) => countsTowardWeeklyLimit(row.status)).length
    if (exceedsCoverageLimit(activeCoverage, MAX_SHIFT_COVERAGE_PER_DAY)) {
      redirect(buildScheduleUrl(cycleId, view, { error: 'coverage_max_exceeded' }))
    }
  }

  if (countsTowardWeeklyLimit(status) && !overrideWeeklyRules) {
    const bounds = getWeekBoundsForDate(date)
    if (!bounds) {
      redirect(buildScheduleUrl(cycleId, view, { error: 'add_shift_failed' }))
    }

    const { data: weeklyShiftsData, error: weeklyShiftsError } = await supabase
      .from('shifts')
      .select('date, status')
      .eq('user_id', userId)
      .gte('date', bounds.weekStart)
      .lte('date', bounds.weekEnd)

    if (weeklyShiftsError) {
      console.error('Failed to load weekly shifts for limit check:', weeklyShiftsError)
      redirect(buildScheduleUrl(cycleId, view, { error: 'add_shift_failed' }))
    }

    const workedDates = new Set<string>()
    for (const row of (weeklyShiftsData ?? []) as Array<{ date: string; status: ShiftStatus }>) {
      if (!countsTowardWeeklyLimit(row.status)) continue
      workedDates.add(row.date)
    }

    if (exceedsWeeklyLimit(workedDates, date, MAX_WORK_DAYS_PER_WEEK)) {
      redirect(
        buildScheduleUrl(cycleId, view, {
          error: 'weekly_limit_exceeded',
          week_start: bounds.weekStart,
          week_end: bounds.weekEnd,
        })
      )
    }
  }

  const { error } = await supabase.from('shifts').insert({
    cycle_id: cycleId,
    user_id: userId,
    date,
    shift_type: shiftType,
    status,
    role: 'staff',
  })

  if (error) {
    console.error('Failed to insert shift:', error)
    if (error.code === '23505') {
      redirect(buildScheduleUrl(cycleId, view, { error: 'duplicate_shift' }))
    }
    redirect(buildScheduleUrl(cycleId, view, { error: 'add_shift_failed' }))
  }

  revalidatePath('/schedule')
  redirect(buildScheduleUrl(cycleId, view))
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

  if (!cycleId) {
    redirect(buildScheduleUrl(undefined, view, { error: 'auto_missing_cycle' }))
  }

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, start_date, end_date, published')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    console.error('Failed to load cycle for auto-generation:', cycleError)
    redirect(buildScheduleUrl(cycleId, view, { error: 'auto_generate_failed' }))
  }

  if (cycle.published) {
    redirect(buildScheduleUrl(cycleId, view, { error: 'auto_cycle_published' }))
  }

  const { data: therapistsData, error: therapistsError } = await supabase
    .from('profiles')
    .select('id, full_name, shift_type, is_lead_eligible')
    .eq('role', 'therapist')
    .order('full_name', { ascending: true })

  if (therapistsError) {
    console.error('Failed to load therapists for auto-generation:', therapistsError)
    redirect(buildScheduleUrl(cycleId, view, { error: 'auto_generate_failed' }))
  }

  const therapists = (therapistsData ?? []) as Therapist[]
  if (therapists.length === 0) {
    redirect(buildScheduleUrl(cycleId, view, { error: 'auto_no_therapists' }))
  }

  const cycleDates = buildDateRange(cycle.start_date, cycle.end_date)
  if (cycleDates.length === 0) {
    redirect(buildScheduleUrl(cycleId, view, { error: 'auto_generate_failed' }))
  }

  const firstWeekBounds = getWeekBoundsForDate(cycle.start_date)
  const lastWeekBounds = getWeekBoundsForDate(cycle.end_date)
  if (!firstWeekBounds || !lastWeekBounds) {
    redirect(buildScheduleUrl(cycleId, view, { error: 'auto_generate_failed' }))
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
    redirect(buildScheduleUrl(cycleId, view, { error: 'auto_generate_failed' }))
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
  for (const shift of existingShifts) {
    if (countsTowardWeeklyLimit(shift.status)) {
      const slotKey = coverageSlotKey(shift.date, shift.shift_type)
      const coverage = coverageBySlot.get(slotKey) ?? 0
      coverageBySlot.set(slotKey, coverage + 1)
    }
    const assignedForDate = assignedUserIdsByDate.get(shift.date) ?? new Set<string>()
    assignedForDate.add(shift.user_id)
    assignedUserIdsByDate.set(shift.date, assignedForDate)
  }

  const dayTherapists = therapists.filter((therapist) => therapist.shift_type === 'day')
  const nightTherapists = therapists.filter((therapist) => therapist.shift_type === 'night')

  let dayCursor = 0
  let nightCursor = 0
  let unfilledSlots = 0

  const draftShiftsToInsert: Array<{
    cycle_id: string
    user_id: string
    date: string
    shift_type: 'day' | 'night'
    status: 'scheduled'
    role: 'staff'
  }> = []

  for (const date of cycleDates) {
    const assignedForDate = assignedUserIdsByDate.get(date) ?? new Set<string>()
    assignedUserIdsByDate.set(date, assignedForDate)

    let dayCoverage = coverageBySlot.get(coverageSlotKey(date, 'day')) ?? 0
    while (dayCoverage < MIN_SHIFT_COVERAGE_PER_DAY) {
      const dayPick = pickTherapistForDate(
        dayTherapists,
        dayCursor,
        date,
        unavailableDatesByUser,
        assignedForDate,
        weeklyWorkedDatesByUserWeek
      )
      dayCursor = dayPick.nextCursor

      if (dayPick.therapist) {
        draftShiftsToInsert.push({
          cycle_id: cycleId,
          user_id: dayPick.therapist.id,
          date,
          shift_type: 'day',
          status: 'scheduled',
          role: 'staff',
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
        coverageBySlot.set(coverageSlotKey(date, 'day'), dayCoverage)
      } else {
        unfilledSlots += MIN_SHIFT_COVERAGE_PER_DAY - dayCoverage
        break
      }
    }

    let nightCoverage = coverageBySlot.get(coverageSlotKey(date, 'night')) ?? 0
    while (nightCoverage < MIN_SHIFT_COVERAGE_PER_DAY) {
      const nightPick = pickTherapistForDate(
        nightTherapists,
        nightCursor,
        date,
        unavailableDatesByUser,
        assignedForDate,
        weeklyWorkedDatesByUserWeek
      )
      nightCursor = nightPick.nextCursor

      if (nightPick.therapist) {
        draftShiftsToInsert.push({
          cycle_id: cycleId,
          user_id: nightPick.therapist.id,
          date,
          shift_type: 'night',
          status: 'scheduled',
          role: 'staff',
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
        coverageBySlot.set(coverageSlotKey(date, 'night'), nightCoverage)
      } else {
        unfilledSlots += MIN_SHIFT_COVERAGE_PER_DAY - nightCoverage
        break
      }
    }
  }

  if (draftShiftsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('shifts')
      .upsert(draftShiftsToInsert, { onConflict: 'cycle_id,user_id,date', ignoreDuplicates: true })

    if (insertError) {
      console.error('Failed to insert auto-generated shifts:', insertError)
      redirect(buildScheduleUrl(cycleId, view, { error: 'auto_generate_failed' }))
    }
  }

  revalidatePath('/schedule')
  redirect(
    buildScheduleUrl(cycleId, view, {
      auto: 'generated',
      added: String(draftShiftsToInsert.length),
      unfilled: String(unfilledSlots),
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
    redirect('/schedule')
  }

  const { error } = await supabase.from('shifts').delete().eq('id', shiftId)
  if (error) {
    console.error('Failed to delete shift:', error)
  }

  revalidatePath('/schedule')
  redirect(buildScheduleUrl(cycleId, view))
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

  if (!cycleId || !therapistId || !date || (shiftType !== 'day' && shiftType !== 'night')) {
    redirect(buildScheduleUrl(cycleId || undefined, view, { error: 'set_lead_failed' }))
  }

  const { data: therapist, error: therapistError } = await supabase
    .from('profiles')
    .select('id, role, is_lead_eligible')
    .eq('id', therapistId)
    .maybeSingle()

  if (therapistError || !therapist || therapist.role !== 'therapist' || !therapist.is_lead_eligible) {
    redirect(buildScheduleUrl(cycleId, view, { error: 'set_lead_not_eligible' }))
  }

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
    redirect(buildScheduleUrl(cycleId, view, { error: 'set_lead_failed' }))
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
      redirect(buildScheduleUrl(cycleId, view, { error: 'set_lead_failed' }))
    }

    const activeCoverage = (sameSlotShifts ?? []).filter((row) => countsTowardWeeklyLimit(row.status)).length
    if (exceedsCoverageLimit(activeCoverage, MAX_SHIFT_COVERAGE_PER_DAY)) {
      redirect(buildScheduleUrl(cycleId, view, { error: 'set_lead_coverage_max' }))
    }

    const bounds = getWeekBoundsForDate(date)
    if (!bounds) {
      redirect(buildScheduleUrl(cycleId, view, { error: 'set_lead_failed' }))
    }

    const { data: weeklyShiftsData, error: weeklyShiftsError } = await supabase
      .from('shifts')
      .select('date, status')
      .eq('user_id', therapistId)
      .gte('date', bounds.weekStart)
      .lte('date', bounds.weekEnd)

    if (weeklyShiftsError) {
      console.error('Failed to load weekly shifts for designated lead action:', weeklyShiftsError)
      redirect(buildScheduleUrl(cycleId, view, { error: 'set_lead_failed' }))
    }

    const workedDates = new Set<string>()
    for (const row of (weeklyShiftsData ?? []) as Array<{ date: string; status: ShiftStatus }>) {
      if (!countsTowardWeeklyLimit(row.status)) continue
      workedDates.add(row.date)
    }

    if (exceedsWeeklyLimit(workedDates, date, MAX_WORK_DAYS_PER_WEEK)) {
      redirect(buildScheduleUrl(cycleId, view, { error: 'set_lead_weekly_limit' }))
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
      redirect(buildScheduleUrl(cycleId, view, { error: 'set_lead_not_eligible' }))
    }
    if (mutationResult.reason === 'multiple_leads_prevented') {
      redirect(buildScheduleUrl(cycleId, view, { error: 'set_lead_multiple' }))
    }
    redirect(buildScheduleUrl(cycleId, view, { error: 'set_lead_failed' }))
  }

  revalidatePath('/schedule')
  redirect(buildScheduleUrl(cycleId, view))
}
