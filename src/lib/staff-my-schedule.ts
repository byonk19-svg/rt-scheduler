import type { SupabaseClient } from '@supabase/supabase-js'

import { dateRange, formatHumanCycleRange, siteLocalDateKey } from '@/lib/calendar-utils'
import { isPreliminaryScheduleBlock, isPublishedScheduleBlock } from '@/lib/schedule-block-state'

export type MyScheduleShiftRow = {
  id: string
  cycle_id: string
  user_id?: string | null
  date: string
  shift_type: string
  role: string | null
  status: string
  assignment_status: string | null
  schedule_cycles: { published: boolean } | { published: boolean }[] | null
}

export type StaffScheduleBlockCycle = {
  id: string
  label: string | null
  start_date: string
  end_date: string
  published: boolean | null
  status?: string | null
}

export type StaffScheduleBlockShiftRow = {
  id: string
  cycle_id: string
  user_id: string | null
  date: string
  shift_type: 'day' | 'night'
  role: string | null
  status: string | null
  assignment_status: string | null
  profiles: { full_name: string | null } | { full_name: string | null }[] | null
}

type StaffScheduleRequestGuidance = 'same_day_contact_manager' | null

export type StaffScheduleBlockDay = {
  date: string
  isToday: boolean
  isWeekend: boolean
  assignment: {
    id: string
    shiftType: 'day' | 'night'
    role: string
    status: string
    assignmentStatus: string | null
    canRequestChange: boolean
    requestGuidance: StaffScheduleRequestGuidance
    isLead: boolean
    leadName: string | null
    coworkerNames: string[]
    coworkerCount: number
  } | null
}

export type StaffScheduleBlockView = {
  cycleId: string
  title: string
  dateRangeLabel: string
  lifecycleLabel: string
  days: StaffScheduleBlockDay[]
  assignedCount: number
  nextAssignmentDate: string | null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeAssignmentStatus(value: string | null): string | null {
  if (!value || value === 'scheduled') return null
  return value
}

function lifecycleLabelForCycle(cycle: StaffScheduleBlockCycle): string {
  if (isPublishedScheduleBlock(cycle)) return 'Final schedule published'
  if (isPreliminaryScheduleBlock(cycle)) return 'Preliminary - review open'
  return 'Schedule not final yet'
}

function isWorkingAssignment(row: StaffScheduleBlockShiftRow): boolean {
  return row.assignment_status !== 'cancelled' && row.assignment_status !== 'call_in'
}

function hasNormalScheduledStatus(row: StaffScheduleBlockShiftRow): boolean {
  return (
    (row.status ?? 'scheduled') === 'scheduled' &&
    normalizeAssignmentStatus(row.assignment_status) === null
  )
}

export function buildStaffScheduleBlockView(params: {
  cycle: StaffScheduleBlockCycle
  shifts: StaffScheduleBlockShiftRow[]
  userId: string
  todayKey: string
}): StaffScheduleBlockView {
  const byDate = new Map<string, StaffScheduleBlockShiftRow[]>()
  for (const shift of params.shifts) {
    const rows = byDate.get(shift.date) ?? []
    rows.push(shift)
    byDate.set(shift.date, rows)
  }

  const days = dateRange(params.cycle.start_date, params.cycle.end_date).map((date) => {
    const parsed = new Date(`${date}T12:00:00`)
    const dayShifts = byDate.get(date) ?? []
    const ownShift = dayShifts.find((shift) => shift.user_id === params.userId) ?? null

    if (!ownShift) {
      return {
        date,
        isToday: date === params.todayKey,
        isWeekend: parsed.getDay() === 0 || parsed.getDay() === 6,
        assignment: null,
      }
    }

    const sameShiftRows = dayShifts.filter(
      (shift) => shift.shift_type === ownShift.shift_type && isWorkingAssignment(shift)
    )
    const leadRow =
      sameShiftRows.find((shift) => shift.role === 'lead' && shift.user_id !== params.userId) ??
      sameShiftRows.find((shift) => shift.role === 'lead') ??
      null
    const coworkerNames = sameShiftRows
      .filter((shift) => shift.user_id && shift.user_id !== params.userId)
      .map((shift) => getOne(shift.profiles)?.full_name ?? 'Coworker')
      .filter((name, index, list) => list.indexOf(name) === index)
    const requestGuidance: StaffScheduleRequestGuidance =
      hasNormalScheduledStatus(ownShift) && date === params.todayKey
        ? 'same_day_contact_manager'
        : null

    return {
      date,
      isToday: date === params.todayKey,
      isWeekend: parsed.getDay() === 0 || parsed.getDay() === 6,
      assignment: {
        id: ownShift.id,
        shiftType: ownShift.shift_type,
        role: ownShift.role ?? 'staff',
        status: ownShift.status ?? 'scheduled',
        assignmentStatus: normalizeAssignmentStatus(ownShift.assignment_status),
        canRequestChange: hasNormalScheduledStatus(ownShift) && date > params.todayKey,
        requestGuidance,
        isLead: ownShift.role === 'lead',
        leadName: ownShift.role === 'lead' ? null : (getOne(leadRow?.profiles)?.full_name ?? null),
        coworkerNames: coworkerNames.slice(0, 3),
        coworkerCount: coworkerNames.length,
      },
    }
  })

  const assignedDays = days.filter((day) => day.assignment)

  return {
    cycleId: params.cycle.id,
    title: params.cycle.label ?? 'Schedule Block',
    dateRangeLabel: formatHumanCycleRange(params.cycle.start_date, params.cycle.end_date),
    lifecycleLabel: lifecycleLabelForCycle(params.cycle),
    days,
    assignedCount: assignedDays.length,
    nextAssignmentDate:
      assignedDays.find((day) => day.date >= params.todayKey)?.date ??
      assignedDays[0]?.date ??
      null,
  }
}

export async function fetchStaffScheduleBlockView(params: {
  supabase: SupabaseClient
  cycle: StaffScheduleBlockCycle | null
  userId: string
  todayKey: string
}): Promise<StaffScheduleBlockView | null> {
  if (!params.cycle) return null

  const { data, error } = await params.supabase
    .from('shifts')
    .select(
      'id, cycle_id, user_id, date, shift_type, role, status, assignment_status, profiles:profiles!shifts_user_id_fkey(full_name)'
    )
    .eq('cycle_id', params.cycle.id)
    .gte('date', params.cycle.start_date)
    .lte('date', params.cycle.end_date)
    .not('user_id', 'is', null)
    .order('date', { ascending: true })

  if (error) {
    console.error('fetchStaffScheduleBlockView:', error)
    return null
  }

  return buildStaffScheduleBlockView({
    cycle: params.cycle,
    shifts: (data ?? []) as StaffScheduleBlockShiftRow[],
    userId: params.userId,
    todayKey: params.todayKey,
  })
}

/** Upcoming shifts for the current user only, published cycles only. */
export async function fetchMyPublishedUpcomingShifts(
  supabase: SupabaseClient,
  userId: string,
  limit: number
): Promise<MyScheduleShiftRow[]> {
  const today = siteLocalDateKey()
  const { data, error } = await supabase
    .from('shifts')
    .select(
      'id, cycle_id, date, shift_type, role, status, assignment_status, schedule_cycles!shifts_cycle_id_fkey!inner(published)'
    )
    .eq('user_id', userId)
    .gte('date', today)
    .eq('schedule_cycles.published', true)
    .not('status', 'eq', 'called_off')
    .neq('assignment_status', 'cancelled')
    .order('date', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('fetchMyPublishedUpcomingShifts:', error)
    return []
  }

  return (data ?? []) as MyScheduleShiftRow[]
}
