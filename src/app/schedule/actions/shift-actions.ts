'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import {
  notifyPublishedShiftAdded,
  notifyPublishedShiftRemoved,
} from '@/lib/published-schedule-notifications'
import {
  buildScheduleUrl,
  countsTowardWeeklyLimit,
  getWeekBoundsForDate,
} from '@/lib/schedule-helpers'
import { exceedsCoverageLimit, exceedsWeeklyLimit } from '@/lib/schedule-rule-validation'
import { MAX_SHIFT_COVERAGE_PER_DAY, MAX_WORK_DAYS_PER_WEEK } from '@/lib/scheduling-constants'
import { setDesignatedLeadMutation } from '@/lib/set-designated-lead'
import { writeAuditLog } from '@/lib/audit-log'
import { createClient } from '@/lib/supabase/server'
import type { ShiftStatus } from '@/app/schedule/types'

import {
  buildCoverageUrl,
  countWorkingScheduledForSlot,
  getPanelParam,
  getRoleForUser,
  getTherapistWeeklyLimit,
  getWeeklyLimitFromProfile,
} from './helpers'

export async function addShiftAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (!can(role, 'manage_schedule')) {
    redirect('/schedule')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const userId = String(formData.get('user_id') ?? '').trim()
  const date = String(formData.get('date') ?? '').trim()
  const shiftType = String(formData.get('shift_type') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()
  const view = String(formData.get('view') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim()
  const showUnavailable = String(formData.get('show_unavailable') ?? '').trim() === 'true'
  const panel = getPanelParam(formData)
  const overrideWeeklyRules = String(formData.get('override_weekly_rules') ?? '').trim() === 'on'
  const viewParams = showUnavailable ? { show_unavailable: 'true' } : undefined
  const buildReturnUrl = (
    cycleIdOverride: string | undefined,
    params?: Record<string, string | undefined>
  ) =>
    returnTo === 'coverage'
      ? buildCoverageUrl(cycleIdOverride, params)
      : buildScheduleUrl(cycleIdOverride, view, params)
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
    redirect(buildReturnUrl(undefined, errorViewParams))
  }

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, published')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    console.error('Failed to load cycle for shift add:', cycleError)
    redirect(buildReturnUrl(cycleId, { ...errorViewParams, error: 'add_shift_failed' }))
  }

  const therapistWeeklyLimit =
    countsTowardWeeklyLimit(status) && !overrideWeeklyRules
      ? await getTherapistWeeklyLimit(supabase, userId)
      : MAX_WORK_DAYS_PER_WEEK

  if (countsTowardWeeklyLimit(status) && !overrideWeeklyRules) {
    const { data: sameSlotShifts, error: sameSlotError } = await supabase
      .from('shifts')
      .select('id')
      .eq('cycle_id', cycleId)
      .eq('date', date)
      .eq('shift_type', shiftType)

    if (sameSlotError) {
      console.error('Failed to load slot coverage for limit check:', sameSlotError)
      redirect(buildReturnUrl(cycleId, { ...errorViewParams, error: 'add_shift_failed' }))
    }

    const activeCoverage = await countWorkingScheduledForSlot(
      supabase,
      (sameSlotShifts ?? []) as Array<{ id: string }>
    )
    if (exceedsCoverageLimit(activeCoverage, MAX_SHIFT_COVERAGE_PER_DAY)) {
      redirect(buildReturnUrl(cycleId, { ...errorViewParams, error: 'coverage_max_exceeded' }))
    }
  }

  if (countsTowardWeeklyLimit(status) && !overrideWeeklyRules) {
    const bounds = getWeekBoundsForDate(date)
    if (!bounds) {
      redirect(buildReturnUrl(cycleId, { ...errorViewParams, error: 'add_shift_failed' }))
    }

    const { data: weeklyShiftsData, error: weeklyShiftsError } = await supabase
      .from('shifts')
      .select('date, status')
      .eq('user_id', userId)
      .gte('date', bounds.weekStart)
      .lte('date', bounds.weekEnd)

    if (weeklyShiftsError) {
      console.error('Failed to load weekly shifts for limit check:', weeklyShiftsError)
      redirect(buildReturnUrl(cycleId, { ...errorViewParams, error: 'add_shift_failed' }))
    }

    const workedDates = new Set<string>()
    for (const row of (weeklyShiftsData ?? []) as Array<{ date: string; status: ShiftStatus }>) {
      if (!countsTowardWeeklyLimit(row.status)) continue
      workedDates.add(row.date)
    }

    if (exceedsWeeklyLimit(workedDates, date, therapistWeeklyLimit)) {
      redirect(
        buildReturnUrl(cycleId, {
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
      redirect(buildReturnUrl(cycleId, { ...errorViewParams, error: 'duplicate_shift' }))
    }
    redirect(buildReturnUrl(cycleId, { ...errorViewParams, error: 'add_shift_failed' }))
  }

  if (insertedShift?.id) {
    await writeAuditLog(supabase, {
      userId: user.id,
      action: 'shift_added',
      targetType: 'shift',
      targetId: insertedShift.id,
    })
  }

  await notifyPublishedShiftAdded(supabase, {
    cyclePublished: Boolean(cycle.published),
    userId,
    date,
    shiftType: shiftType as 'day' | 'night',
    targetId: insertedShift?.id ?? `${cycleId}:${userId}:${date}`,
  })

  revalidatePath('/schedule')
  revalidatePath('/coverage')
  redirect(buildReturnUrl(cycleId, { ...viewParams, success: 'shift_added' }))
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
  if (!can(role, 'manage_schedule')) {
    redirect('/schedule')
  }

  const shiftId = String(formData.get('shift_id') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const view = String(formData.get('view') ?? '').trim()

  if (!shiftId || !cycleId) {
    redirect('/schedule?error=delete_shift_failed')
  }

  const { data: shift, error: shiftLoadError } = await supabase
    .from('shifts')
    .select('id, user_id, date, shift_type')
    .eq('id', shiftId)
    .maybeSingle()

  if (shiftLoadError || !shift) {
    console.error('Failed to load shift before delete:', shiftLoadError)
    redirect(buildScheduleUrl(cycleId, view, { error: 'delete_shift_failed' }))
  }

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, published')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    console.error('Failed to load cycle before delete:', cycleError)
    redirect(buildScheduleUrl(cycleId, view, { error: 'delete_shift_failed' }))
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

  await notifyPublishedShiftRemoved(supabase, {
    cyclePublished: Boolean(cycle.published),
    userId: shift.user_id,
    date: shift.date,
    shiftType: shift.shift_type as 'day' | 'night',
    targetId: shiftId,
  })

  revalidatePath('/schedule')
  revalidatePath('/coverage')
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
  if (!can(role, 'manage_schedule')) {
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
    redirect(
      buildScheduleUrl(cycleId || undefined, view, { ...errorViewParams, error: 'set_lead_failed' })
    )
  }

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, published')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    console.error('Failed to load cycle for designated lead action:', cycleError)
    redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_failed' }))
  }

  const { data: therapist, error: therapistError } = await supabase
    .from('profiles')
    .select('id, role, is_lead_eligible, max_work_days_per_week, employment_type')
    .eq('id', therapistId)
    .maybeSingle()

  if (
    therapistError ||
    !therapist ||
    (therapist.role !== 'therapist' && therapist.role !== 'lead') ||
    !therapist.is_lead_eligible
  ) {
    redirect(
      buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_not_eligible' })
    )
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
      .select('id')
      .eq('cycle_id', cycleId)
      .eq('date', date)
      .eq('shift_type', shiftType)

    if (sameSlotError) {
      console.error('Failed to load slot coverage for designated lead action:', sameSlotError)
      redirect(buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_failed' }))
    }

    const activeCoverage = await countWorkingScheduledForSlot(
      supabase,
      (sameSlotShifts ?? []) as Array<{ id: string }>
    )
    if (exceedsCoverageLimit(activeCoverage, MAX_SHIFT_COVERAGE_PER_DAY)) {
      redirect(
        buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_coverage_max' })
      )
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
      redirect(
        buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_weekly_limit' })
      )
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
      redirect(
        buildScheduleUrl(cycleId, view, { ...errorViewParams, error: 'set_lead_not_eligible' })
      )
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

  if (!existingShift) {
    await notifyPublishedShiftAdded(supabase, {
      cyclePublished: Boolean(cycle.published),
      userId: therapistId,
      date,
      shiftType,
      targetId: `${cycleId}:${therapistId}:${date}:${shiftType}`,
    })
  }

  revalidatePath('/schedule')
  revalidatePath('/coverage')
  redirect(buildScheduleUrl(cycleId, view, { ...viewParams, success: 'lead_updated' }))
}
