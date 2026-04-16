import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { parseRole } from '@/lib/auth/roles'
import { formatHumanCycleRange } from '@/lib/calendar-utils'
import {
  buildAssignmentStoreFromShifts,
  buildAvailabilityApprovalStoreFromSubmittedOverrides,
  type LiveRosterOverrideRow,
  type LiveRosterShiftRow,
} from '@/lib/schedule-roster-data'
import type { AssignmentStore, AvailabilityApprovalStore, Staff } from '@/lib/mock-coverage-roster'

export type ScheduleRosterLivePayload = {
  cycleId: string
  label: string
  startDate: string
  endDate: string
  shortLabel: string
  availableCycles: Array<{ id: string; label: string }>
  staff: Staff[]
  assignments: AssignmentStore
  availabilityApprovals: AvailabilityApprovalStore
}

export type ScheduleRosterPageData =
  | { status: 'ok'; data: ScheduleRosterLivePayload }
  | { status: 'forbidden' }
  | { status: 'no_cycle' }

type CycleRow = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
}

type ProfileRosterRow = {
  id: string
  full_name: string | null
  employment_type: 'full_time' | 'part_time' | 'prn' | null
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function toStaff(row: ProfileRosterRow): Staff {
  return {
    id: row.id,
    name: row.full_name?.trim() || 'Unknown',
    roleLabel: 'Therapist',
    rosterKind: row.employment_type === 'prn' ? 'prn' : 'core',
  }
}

export async function loadScheduleRosterPageData(
  searchParams?: Record<string, string | string[] | undefined>
): Promise<ScheduleRosterPageData> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: 'forbidden' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = parseRole(profile?.role)
  if (role !== 'manager' && role !== 'lead') {
    return { status: 'forbidden' }
  }

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { data: cyclesData } = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published')
    .is('archived_at', null)
    .gte('end_date', todayKey)
    .order('start_date', { ascending: true })

  const cycles = (cyclesData ?? []) as CycleRow[]
  const cycleIdFromParams = firstParam(searchParams?.cycle)
  const selectedCycle =
    cycles.find((c) => c.id === cycleIdFromParams) ??
    cycles.find((c) => c.published === false) ??
    cycles[0] ??
    null

  if (!selectedCycle) {
    return { status: 'no_cycle' }
  }

  const [
    { data: profilesData },
    { data: submissionsData },
    { data: overridesData },
    { data: shiftsData },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, employment_type')
      .in('role', ['therapist', 'lead'])
      .eq('is_active', true)
      .is('archived_at', null)
      .order('full_name', { ascending: true }),
    supabase
      .from('therapist_availability_submissions')
      .select('therapist_id')
      .eq('schedule_cycle_id', selectedCycle.id),
    supabase
      .from('availability_overrides')
      .select('therapist_id, date, shift_type, override_type')
      .eq('cycle_id', selectedCycle.id)
      .eq('source', 'therapist'),
    supabase
      .from('shifts')
      .select('id, user_id, date, shift_type')
      .eq('cycle_id', selectedCycle.id)
      .not('user_id', 'is', null),
  ])

  const submittedTherapistIds = new Set(
    (submissionsData ?? []).map((r) => String((r as { therapist_id: string }).therapist_id))
  )

  const staff = ((profilesData ?? []) as ProfileRosterRow[]).map(toStaff)

  const overrideRows = (overridesData ?? []) as LiveRosterOverrideRow[]
  const availabilityApprovals = buildAvailabilityApprovalStoreFromSubmittedOverrides(
    overrideRows,
    submittedTherapistIds
  )

  const shiftRows = (shiftsData ?? []) as LiveRosterShiftRow[]
  const assignments = buildAssignmentStoreFromShifts(shiftRows)

  const shortLabel = formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)

  return {
    status: 'ok',
    data: {
      cycleId: selectedCycle.id,
      label: selectedCycle.label,
      startDate: selectedCycle.start_date,
      endDate: selectedCycle.end_date,
      shortLabel,
      availableCycles: cycles.map((c) => ({ id: c.id, label: c.label })),
      staff,
      assignments,
      availabilityApprovals,
    },
  }
}
