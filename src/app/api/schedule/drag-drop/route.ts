import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { exceedsCoverageLimit, exceedsWeeklyLimit } from '@/lib/schedule-rule-validation'
import { MAX_WORK_DAYS_PER_WEEK, MAX_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import { countsTowardWeeklyLimit, getWeekBoundsForDate, isDateWithinRange } from '@/lib/schedule-helpers'

type ShiftStatus = 'scheduled' | 'on_call' | 'sick' | 'called_off'
type ShiftRole = 'lead' | 'staff'
type RemovableShift = {
  id: string
  cycle_id: string
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  role: ShiftRole
}
type DragAction =
  | {
      action: 'assign'
      cycleId: string
      userId: string
      shiftType: 'day' | 'night'
      date: string
      overrideWeeklyRules: boolean
    }
  | {
      action: 'move'
      cycleId: string
      shiftId: string
      targetDate: string
      targetShiftType: 'day' | 'night'
      overrideWeeklyRules: boolean
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
        action?: 'assign' | 'move' | 'remove'
        cycleId?: string
        userId?: string
        shiftType?: 'day' | 'night'
        date?: string
        shiftId?: string
        targetDate?: string
        targetShiftType?: 'day' | 'night'
        overrideWeeklyRules?: boolean
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
      if (exceedsWeeklyLimit(weekly.dates, payload.date, MAX_WORK_DAYS_PER_WEEK)) {
        return NextResponse.json(
          { error: 'Therapists are limited to 3 days per week unless override is enabled.' },
          { status: 409 }
        )
      }
    }

    const { error } = await supabase.from('shifts').insert({
      cycle_id: payload.cycleId,
      user_id: payload.userId,
      date: payload.date,
      shift_type: payload.shiftType,
      status: 'scheduled',
      role: 'staff',
    })

    if (error) {
      if (error?.code === '23505') {
        return NextResponse.json({ error: 'That therapist already has a shift on this date.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Could not create shift' }, { status: 500 })
    }

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
      if (exceedsWeeklyLimit(weekly.dates, payload.targetDate, MAX_WORK_DAYS_PER_WEEK)) {
        return NextResponse.json(
          { error: 'Therapists are limited to 3 days per week unless override is enabled.' },
          { status: 409 }
        )
      }
    }

    const { error } = await supabase
      .from('shifts')
      .update({ date: payload.targetDate, shift_type: payload.targetShiftType })
      .eq('id', payload.shiftId)

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Therapist already has a shift on that date.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Could not move shift' }, { status: 500 })
    }

    const undoAction: DragAction = {
      action: 'move',
      cycleId: payload.cycleId,
      shiftId: payload.shiftId,
      targetDate: shift.date as string,
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

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
