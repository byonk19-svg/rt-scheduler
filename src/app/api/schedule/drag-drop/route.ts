import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { setDesignatedLeadMutation } from '@/lib/set-designated-lead'
import { exceedsCoverageLimit, exceedsWeeklyLimit } from '@/lib/schedule-rule-validation'
import { notifyUsers } from '@/lib/notifications'
import { writeAuditLog } from '@/lib/audit-log'
import {
  MAX_WORK_DAYS_PER_WEEK,
  MAX_SHIFT_COVERAGE_PER_DAY,
  getDefaultWeeklyLimitForEmploymentType,
  sanitizeWeeklyLimit,
} from '@/lib/scheduling-constants'
import { countsTowardWeeklyLimit, getWeekBoundsForDate, isDateWithinRange } from '@/lib/schedule-helpers'
import { resolveAvailability } from '@/lib/coverage/resolve-availability'
import { normalizeWorkPattern } from '@/lib/coverage/work-patterns'
import type { AvailabilityOverrideRow as CycleAvailabilityOverrideRow } from '@/lib/coverage/types'
import type { ShiftStatus, ShiftRole, EmploymentType } from '@/app/schedule/types'
type RemovableShift = {
  id: string
  cycle_id: string
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  role: ShiftRole
}

type TherapistAvailabilityState = {
  therapistName: string
  blockedByConstraints: boolean
  unavailableReason: string | null
  forceOff: boolean
  forceOn: boolean
  inactiveOrFmla: boolean
  error?: string
}
type DragAction =
  | {
      action: 'assign'
      cycleId: string
      userId: string
      shiftType: 'day' | 'night'
      date: string
      overrideWeeklyRules: boolean
      availabilityOverride?: boolean
      availabilityOverrideReason?: string
    }
  | {
      action: 'move'
      cycleId: string
      shiftId: string
      targetDate: string
      targetShiftType: 'day' | 'night'
      overrideWeeklyRules: boolean
      availabilityOverride?: boolean
      availabilityOverrideReason?: string
    }
  | {
      action: 'remove'
      cycleId: string
      shiftId: string
    }
  | {
      action: 'remove'
      cycleId: string
      userId: string
      date: string
      shiftType: 'day' | 'night'
    }
  | {
      action: 'set_lead'
      cycleId: string
      therapistId: string
      date: string
      shiftType: 'day' | 'night'
      overrideWeeklyRules: boolean
      availabilityOverride?: boolean
      availabilityOverrideReason?: string
    }

async function getCoverageCountForSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cycleId: string,
  date: string,
  shiftType: 'day' | 'night',
  excludeShiftId?: string
): Promise<{ count: number; error?: string }> {
  let query = supabase
    .from('shifts')
    .select('id, status')
    .eq('cycle_id', cycleId)
    .eq('date', date)
    .eq('shift_type', shiftType)

  if (excludeShiftId) {
    query = query.neq('id', excludeShiftId)
  }

  const { data, error } = await query
  if (error) return { count: 0, error: error.message }

  const count = (data ?? []).filter((shift) => countsTowardWeeklyLimit(shift.status as ShiftStatus)).length
  return { count }
}

async function getWorkedDatesInWeek(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  targetDate: string,
  excludeShiftId?: string
): Promise<{ dates: Set<string>; error?: string }> {
  const bounds = getWeekBoundsForDate(targetDate)
  if (!bounds) return { dates: new Set<string>(), error: 'Invalid target date' }

  let query = supabase
    .from('shifts')
    .select('id, date, status')
    .eq('user_id', userId)
    .gte('date', bounds.weekStart)
    .lte('date', bounds.weekEnd)

  if (excludeShiftId) {
    query = query.neq('id', excludeShiftId)
  }

  const { data, error } = await query
  if (error) return { dates: new Set<string>(), error: error.message }

  const workedDates = new Set<string>()
  for (const shift of data ?? []) {
    if (!countsTowardWeeklyLimit(shift.status as ShiftStatus)) continue
    workedDates.add(shift.date as string)
  }
  return { dates: workedDates }
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

  const profile = data as { max_work_days_per_week: number | null; employment_type: EmploymentType | null } | null
  const fallback = getDefaultWeeklyLimitForEmploymentType(profile?.employment_type)
  return sanitizeWeeklyLimit(profile?.max_work_days_per_week, fallback)
}

async function getTherapistAvailabilityState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  therapistId: string,
  cycleId: string,
  date: string,
  shiftType: 'day' | 'night'
): Promise<TherapistAvailabilityState> {
  const [profileResult, availabilityResult, patternResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, is_active, on_fmla')
      .eq('id', therapistId)
      .maybeSingle(),
    supabase
      .from('availability_overrides')
      .select('cycle_id, therapist_id, date, shift_type, override_type, note')
      .eq('therapist_id', therapistId)
      .eq('cycle_id', cycleId)
      .eq('date', date),
    supabase
      .from('work_patterns')
      .select('therapist_id, works_dow, offs_dow, weekend_rotation, weekend_anchor_date, works_dow_mode, shift_preference')
      .eq('therapist_id', therapistId)
      .maybeSingle(),
  ])

  if (profileResult.error || availabilityResult.error || patternResult.error || !profileResult.data) {
    return {
      therapistName: 'Therapist',
      blockedByConstraints: false,
      unavailableReason: null,
      forceOff: false,
      forceOn: false,
      inactiveOrFmla: false,
      error: 'Failed to validate availability constraints.',
    }
  }

  const therapistName = String(profileResult.data?.full_name ?? 'Therapist')
  const pattern = patternResult.data
    ? normalizeWorkPattern({
        therapist_id: therapistId,
        works_dow: patternResult.data.works_dow,
        offs_dow: patternResult.data.offs_dow,
        weekend_rotation: patternResult.data.weekend_rotation,
        weekend_anchor_date: patternResult.data.weekend_anchor_date,
        works_dow_mode: patternResult.data.works_dow_mode,
        shift_preference: patternResult.data.shift_preference,
      })
    : normalizeWorkPattern({
        therapist_id: therapistId,
        works_dow: [],
        offs_dow: [],
        weekend_rotation: 'none',
        weekend_anchor_date: null,
        works_dow_mode: 'hard',
        shift_preference: 'either',
      })

  const overrides = (availabilityResult.data ?? []) as CycleAvailabilityOverrideRow[]
  const resolution = resolveAvailability({
    therapistId,
    cycleId,
    date,
    shiftType,
    isActive: profileResult.data.is_active !== false,
    onFmla: profileResult.data.on_fmla === true,
    pattern,
    overrides,
  })
  const reasonLabel =
    resolution.reason === 'override_force_off'
      ? 'Force off override'
      : resolution.reason === 'blocked_offs_dow'
        ? 'Never works this weekday'
        : resolution.reason === 'blocked_every_other_weekend'
          ? 'Off weekend by alternating rotation'
          : resolution.reason === 'blocked_outside_works_dow_hard'
            ? 'Outside hard works-day rule'
            : resolution.reason === 'inactive'
              ? 'Inactive therapist'
              : resolution.reason === 'on_fmla'
                ? 'Therapist on FMLA'
                : null

  return {
    therapistName,
    blockedByConstraints: !resolution.allowed,
    unavailableReason: reasonLabel,
    forceOff: resolution.reason === 'override_force_off',
    forceOn: resolution.reason === 'override_force_on',
    inactiveOrFmla: resolution.reason === 'inactive' || resolution.reason === 'on_fmla',
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        action?: 'assign' | 'move' | 'remove' | 'set_lead'
        cycleId?: string
        userId?: string
        therapistId?: string
        shiftType?: 'day' | 'night'
        date?: string
        shiftId?: string
        targetDate?: string
        targetShiftType?: 'day' | 'night'
        overrideWeeklyRules?: boolean
        availabilityOverride?: boolean
        availabilityOverrideReason?: string
      }
    | null

  if (!payload?.action || !payload.cycleId) {
    return NextResponse.json({ error: 'Missing action or cycleId' }, { status: 400 })
  }

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, start_date, end_date')
    .eq('id', payload.cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    return NextResponse.json({ error: 'Schedule cycle not found' }, { status: 404 })
  }

  if (payload.action === 'assign') {
    if (!payload.userId || !payload.shiftType || !payload.date) {
      return NextResponse.json({ error: 'Missing assignment data' }, { status: 400 })
    }
    if (!isDateWithinRange(payload.date, cycle.start_date, cycle.end_date)) {
      return NextResponse.json({ error: 'Date is outside this cycle' }, { status: 400 })
    }

    const availabilityState = await getTherapistAvailabilityState(
      supabase,
      payload.userId,
      payload.cycleId,
      payload.date,
      payload.shiftType
    )
    if (availabilityState.error) {
      return NextResponse.json({ error: availabilityState.error }, { status: 500 })
    }
    if (availabilityState.blockedByConstraints && availabilityState.inactiveOrFmla) {
      return NextResponse.json(
        {
          error: availabilityState.unavailableReason ?? 'This therapist cannot be assigned.',
        },
        { status: 409 }
      )
    }
    if (availabilityState.blockedByConstraints && payload.availabilityOverride !== true) {
      return NextResponse.json(
        {
          error: 'Conflicts with scheduling constraints.',
          code: 'availability_conflict',
          availability: {
            therapistId: payload.userId,
            therapistName: availabilityState.therapistName,
            date: payload.date,
            shiftType: payload.shiftType,
            reason: availabilityState.unavailableReason,
          },
        },
        { status: 409 }
      )
    }

    if (!payload.overrideWeeklyRules) {
      const coverage = await getCoverageCountForSlot(
        supabase,
        payload.cycleId,
        payload.date,
        payload.shiftType
      )
      if (coverage.error) {
        return NextResponse.json({ error: 'Failed to validate daily coverage limit.' }, { status: 500 })
      }
      if (exceedsCoverageLimit(coverage.count, MAX_SHIFT_COVERAGE_PER_DAY)) {
        return NextResponse.json(
          { error: `Each shift can have at most ${MAX_SHIFT_COVERAGE_PER_DAY} scheduled team members.` },
          { status: 409 }
        )
      }

      const weekly = await getWorkedDatesInWeek(supabase, payload.userId, payload.date)
      if (weekly.error) {
        return NextResponse.json({ error: 'Failed to validate weekly rule' }, { status: 500 })
      }
      const weeklyLimit = await getTherapistWeeklyLimit(supabase, payload.userId)
      if (exceedsWeeklyLimit(weekly.dates, payload.date, weeklyLimit)) {
        return NextResponse.json(
          { error: `Therapists are limited to ${weeklyLimit} day(s) per week unless override is enabled.` },
          { status: 409 }
        )
      }
    }

    const shouldSetAvailabilityOverride =
      availabilityState.blockedByConstraints &&
      !availabilityState.inactiveOrFmla &&
      payload.availabilityOverride === true
    const normalizedAvailabilityOverrideReason =
      typeof payload.availabilityOverrideReason === 'string'
        ? payload.availabilityOverrideReason.trim() || null
        : null

    const { data: insertedShift, error } = await supabase
      .from('shifts')
      .insert({
        cycle_id: payload.cycleId,
        user_id: payload.userId,
        date: payload.date,
        shift_type: payload.shiftType,
        status: 'scheduled',
        role: 'staff',
        availability_override: shouldSetAvailabilityOverride,
        availability_override_reason: shouldSetAvailabilityOverride
          ? normalizedAvailabilityOverrideReason
          : null,
        availability_override_by: shouldSetAvailabilityOverride ? user.id : null,
        availability_override_at: shouldSetAvailabilityOverride ? new Date().toISOString() : null,
      })
      .select('id')
      .single()

    if (error) {
      if (error?.code === '23505') {
        return NextResponse.json({ error: 'That therapist already has a shift on this date.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Could not create shift' }, { status: 500 })
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
      userIds: [payload.userId],
      eventType: 'shift_assigned',
      title: 'New shift assigned',
      message: `You were assigned a ${payload.shiftType} shift on ${payload.date}.`,
      targetType: 'shift',
      targetId: insertedShift?.id ?? `${payload.cycleId}:${payload.userId}:${payload.date}`,
    })

    const undoAction: DragAction = {
      action: 'remove',
      cycleId: payload.cycleId,
      userId: payload.userId,
      date: payload.date,
      shiftType: payload.shiftType,
    }

    return NextResponse.json({ message: 'Shift assigned.', undoAction })
  }

  if (payload.action === 'move') {
    if (!payload.shiftId || !payload.targetDate || !payload.targetShiftType) {
      return NextResponse.json({ error: 'Missing move data' }, { status: 400 })
    }
    if (!isDateWithinRange(payload.targetDate, cycle.start_date, cycle.end_date)) {
      return NextResponse.json({ error: 'Date is outside this cycle' }, { status: 400 })
    }

    const { data: shift, error: shiftError } = await supabase
      .from('shifts')
      .select('id, cycle_id, user_id, date, shift_type, status, role')
      .eq('id', payload.shiftId)
      .maybeSingle()

    if (shiftError || !shift || shift.cycle_id !== payload.cycleId) {
      return NextResponse.json({ error: 'Shift not found in this cycle' }, { status: 404 })
    }

    if (shift.date === payload.targetDate && shift.shift_type === payload.targetShiftType) {
      return NextResponse.json({ message: 'Shift already on that date.' })
    }

    const availabilityState = await getTherapistAvailabilityState(
      supabase,
      shift.user_id,
      payload.cycleId,
      payload.targetDate,
      payload.targetShiftType
    )
    if (availabilityState.error) {
      return NextResponse.json({ error: availabilityState.error }, { status: 500 })
    }
    if (availabilityState.blockedByConstraints && availabilityState.inactiveOrFmla) {
      return NextResponse.json(
        {
          error: availabilityState.unavailableReason ?? 'This therapist cannot be assigned.',
        },
        { status: 409 }
      )
    }
    if (availabilityState.blockedByConstraints && payload.availabilityOverride !== true) {
      return NextResponse.json(
        {
          error: 'Conflicts with scheduling constraints.',
          code: 'availability_conflict',
          availability: {
            therapistId: shift.user_id,
            therapistName: availabilityState.therapistName,
            date: payload.targetDate,
            shiftType: payload.targetShiftType,
            reason: availabilityState.unavailableReason,
          },
        },
        { status: 409 }
      )
    }

    if (!payload.overrideWeeklyRules && countsTowardWeeklyLimit(shift.status as ShiftStatus)) {
      const coverage = await getCoverageCountForSlot(
        supabase,
        payload.cycleId,
        payload.targetDate,
        payload.targetShiftType,
        shift.id
      )
      if (coverage.error) {
        return NextResponse.json({ error: 'Failed to validate daily coverage limit.' }, { status: 500 })
      }
      if (exceedsCoverageLimit(coverage.count, MAX_SHIFT_COVERAGE_PER_DAY)) {
        return NextResponse.json(
          { error: `Each shift can have at most ${MAX_SHIFT_COVERAGE_PER_DAY} scheduled team members.` },
          { status: 409 }
        )
      }

      const weekly = await getWorkedDatesInWeek(supabase, shift.user_id, payload.targetDate, shift.id)
      if (weekly.error) {
        return NextResponse.json({ error: 'Failed to validate weekly rule' }, { status: 500 })
      }
      const weeklyLimit = await getTherapistWeeklyLimit(supabase, shift.user_id)
      if (exceedsWeeklyLimit(weekly.dates, payload.targetDate, weeklyLimit)) {
        return NextResponse.json(
          { error: `Therapists are limited to ${weeklyLimit} day(s) per week unless override is enabled.` },
          { status: 409 }
        )
      }
    }

    const shouldSetAvailabilityOverride =
      availabilityState.blockedByConstraints &&
      !availabilityState.inactiveOrFmla &&
      payload.availabilityOverride === true
    const normalizedAvailabilityOverrideReason =
      typeof payload.availabilityOverrideReason === 'string'
        ? payload.availabilityOverrideReason.trim() || null
        : null

    const { error } = await supabase
      .from('shifts')
      .update({
        date: payload.targetDate,
        shift_type: payload.targetShiftType,
        availability_override: shouldSetAvailabilityOverride,
        availability_override_reason: shouldSetAvailabilityOverride
          ? normalizedAvailabilityOverrideReason
          : null,
        availability_override_by: shouldSetAvailabilityOverride ? user.id : null,
        availability_override_at: shouldSetAvailabilityOverride ? new Date().toISOString() : null,
      })
      .eq('id', payload.shiftId)

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Therapist already has a shift on that date.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Could not move shift' }, { status: 500 })
    }

    if (!shift.date || !shift.shift_type) {
      return NextResponse.json({ error: 'Incomplete shift data' }, { status: 422 })
    }

    const undoAction: DragAction = {
      action: 'move',
      cycleId: payload.cycleId,
      shiftId: payload.shiftId,
      targetDate: shift.date,
      targetShiftType: shift.shift_type as 'day' | 'night',
      overrideWeeklyRules: true,
    }

    return NextResponse.json({ message: 'Shift moved.', undoAction })
  }

  if (payload.action === 'remove') {
    let shift: RemovableShift | null = null
    let shiftError: string | null = null

    if (payload.shiftId) {
      const result = await supabase
        .from('shifts')
        .select('id, cycle_id, user_id, date, shift_type, role')
        .eq('id', payload.shiftId)
        .maybeSingle()
      shift = (result.data as RemovableShift | null) ?? null
      shiftError = result.error?.message ?? null
    } else if (payload.userId && payload.date && payload.shiftType) {
      const result = await supabase
        .from('shifts')
        .select('id, cycle_id, user_id, date, shift_type, role')
        .eq('cycle_id', payload.cycleId)
        .eq('user_id', payload.userId)
        .eq('date', payload.date)
        .eq('shift_type', payload.shiftType)
        .maybeSingle()
      shift = (result.data as RemovableShift | null) ?? null
      shiftError = result.error?.message ?? null
    } else {
      return NextResponse.json({ error: 'Missing remove data' }, { status: 400 })
    }

    if (shiftError || !shift || shift.cycle_id !== payload.cycleId) {
      return NextResponse.json({ error: 'Shift not found in this cycle' }, { status: 404 })
    }

    const { error } = await supabase.from('shifts').delete().eq('id', shift.id)
    if (error) {
      return NextResponse.json({ error: 'Could not remove shift' }, { status: 500 })
    }

    await writeAuditLog(supabase, {
      userId: user.id,
      action: 'shift_removed',
      targetType: 'shift',
      targetId: shift.id,
    })

    const undoAction: DragAction = {
      action: 'assign',
      cycleId: payload.cycleId,
      userId: shift.user_id as string,
      shiftType: shift.shift_type as 'day' | 'night',
      date: shift.date as string,
      overrideWeeklyRules: true,
    }

    return NextResponse.json({ message: 'Shift removed from schedule.', undoAction })
  }

  if (payload.action === 'set_lead') {
    if (!payload.therapistId || !payload.shiftType || !payload.date) {
      return NextResponse.json({ error: 'Missing designated lead data' }, { status: 400 })
    }
    if (!isDateWithinRange(payload.date, cycle.start_date, cycle.end_date)) {
      return NextResponse.json({ error: 'Date is outside this cycle' }, { status: 400 })
    }

    const { data: therapist, error: therapistError } = await supabase
      .from('profiles')
      .select('id, role, is_lead_eligible')
      .eq('id', payload.therapistId)
      .maybeSingle()

    if (
      therapistError ||
      !therapist ||
      therapist.role !== 'therapist' ||
      !therapist.is_lead_eligible
    ) {
      return NextResponse.json(
        { error: 'Only lead-eligible therapists can be designated as lead.' },
        { status: 409 }
      )
    }

    const availabilityState = await getTherapistAvailabilityState(
      supabase,
      payload.therapistId,
      payload.cycleId,
      payload.date,
      payload.shiftType
    )
    if (availabilityState.error) {
      return NextResponse.json({ error: availabilityState.error }, { status: 500 })
    }
    if (availabilityState.blockedByConstraints && availabilityState.inactiveOrFmla) {
      return NextResponse.json(
        {
          error: availabilityState.unavailableReason ?? 'This therapist cannot be assigned.',
        },
        { status: 409 }
      )
    }
    if (availabilityState.blockedByConstraints && payload.availabilityOverride !== true) {
      return NextResponse.json(
        {
          error: 'Conflicts with scheduling constraints.',
          code: 'availability_conflict',
          availability: {
            therapistId: payload.therapistId,
            therapistName: availabilityState.therapistName,
            date: payload.date,
            shiftType: payload.shiftType,
            reason: availabilityState.unavailableReason,
          },
        },
        { status: 409 }
      )
    }

    const { data: existingShift, error: existingShiftError } = await supabase
      .from('shifts')
      .select('id, status')
      .eq('cycle_id', payload.cycleId)
      .eq('user_id', payload.therapistId)
      .eq('date', payload.date)
      .eq('shift_type', payload.shiftType)
      .maybeSingle()

    if (existingShiftError) {
      return NextResponse.json(
        { error: 'Failed to load existing shift for lead validation.' },
        { status: 500 }
      )
    }

    if (!existingShift) {
      if (!payload.overrideWeeklyRules) {
        const coverage = await getCoverageCountForSlot(
          supabase,
          payload.cycleId,
          payload.date,
          payload.shiftType
        )
        if (coverage.error) {
          return NextResponse.json(
            { error: 'Failed to validate daily coverage limit.' },
            { status: 500 }
          )
        }
        if (exceedsCoverageLimit(coverage.count, MAX_SHIFT_COVERAGE_PER_DAY)) {
          return NextResponse.json(
            { error: `Each shift can have at most ${MAX_SHIFT_COVERAGE_PER_DAY} scheduled team members.` },
            { status: 409 }
          )
        }

        const weekly = await getWorkedDatesInWeek(
          supabase,
          payload.therapistId,
          payload.date
        )
        if (weekly.error) {
          return NextResponse.json({ error: 'Failed to validate weekly rule' }, { status: 500 })
        }
        const weeklyLimit = await getTherapistWeeklyLimit(supabase, payload.therapistId)
        if (exceedsWeeklyLimit(weekly.dates, payload.date, weeklyLimit)) {
          return NextResponse.json(
            { error: `Therapists are limited to ${weeklyLimit} day(s) per week unless override is enabled.` },
            { status: 409 }
          )
        }
      }
    }

    const mutationResult = await setDesignatedLeadMutation(supabase, {
      cycleId: payload.cycleId,
      therapistId: payload.therapistId,
      date: payload.date,
      shiftType: payload.shiftType,
    })

    if (!mutationResult.ok) {
      if (mutationResult.reason === 'lead_not_eligible') {
        return NextResponse.json(
          { error: 'Only lead-eligible therapists can be designated as lead.' },
          { status: 409 }
        )
      }
      if (mutationResult.reason === 'multiple_leads_prevented') {
        return NextResponse.json(
          { error: 'A designated lead already exists for that shift.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'Could not set designated lead.' },
        { status: 500 }
      )
    }

    await writeAuditLog(supabase, {
      userId: user.id,
      action: 'designated_lead_assigned',
      targetType: 'shift_slot',
      targetId: `${payload.cycleId}:${payload.date}:${payload.shiftType}`,
    })

    const shouldSetAvailabilityOverride =
      availabilityState.blockedByConstraints &&
      !availabilityState.inactiveOrFmla &&
      payload.availabilityOverride === true
    const normalizedAvailabilityOverrideReason =
      typeof payload.availabilityOverrideReason === 'string'
        ? payload.availabilityOverrideReason.trim() || null
        : null
    const { error: overrideUpdateError } = await supabase
      .from('shifts')
      .update({
        availability_override: shouldSetAvailabilityOverride,
        availability_override_reason: shouldSetAvailabilityOverride
          ? normalizedAvailabilityOverrideReason
          : null,
        availability_override_by: shouldSetAvailabilityOverride ? user.id : null,
        availability_override_at: shouldSetAvailabilityOverride ? new Date().toISOString() : null,
      })
      .eq('cycle_id', payload.cycleId)
      .eq('user_id', payload.therapistId)
      .eq('date', payload.date)
      .eq('shift_type', payload.shiftType)

    if (overrideUpdateError) {
      return NextResponse.json({ error: 'Could not record availability override metadata.' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Designated lead updated.' })
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
