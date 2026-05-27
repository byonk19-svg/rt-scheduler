import 'server-only'

import { can } from '@/lib/auth/can'
import { parseRole, type Role } from '@/lib/auth/roles'
import { dateRange, formatHumanCycleRange } from '@/lib/calendar-utils'
import {
  defaultCoverageShiftTabFromProfileShift,
  parseCoverageShiftSearchParam,
  shiftTabToQueryValue,
} from '@/lib/coverage/coverage-shift-tab'
import { loadDraftInputsForCycle, toDraftInputSupabaseClient } from '@/lib/coverage/draft-inputs'
import { generateDraftForCycle } from '@/lib/coverage/generate-draft'
import { summarizePreFlight } from '@/lib/coverage/pre-flight'
import { fetchActiveOperationalDetailMap } from '@/lib/operational-codes'
import { createClient } from '@/lib/supabase/server'

import { buildDailyTotals } from '@/components/schedule-grid/schedule-grid-utils'
import type {
  GridDataset,
  ScheduleGridPreFlightSummary,
} from '@/components/schedule-grid/schedule-grid-types'
import {
  buildAvailableCycleOptions,
  buildTherapistGridRows,
  isCyclePublished,
  resolveScheduleInteractionMode,
  selectScheduleCycle,
  shapePreFlightSummary,
  type CycleRow,
  type ForceOffOverrideRow,
  type ShiftRow,
  type TherapistRow,
} from './schedule-grid-model'

type ViewerProfile = {
  role: Role | null
  shift_type: 'day' | 'night' | null
  is_active: boolean | null
  archived_at: string | null
  site_id: string | null
}

export type ScheduleGridServerData =
  | {
      status: 'ok'
      dataset: GridDataset
      initialShiftTab: 'Day' | 'Night'
      preFlightSummary: ScheduleGridPreFlightSummary | null
    }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'no_cycle' }
  | { status: 'load_error' }

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function scheduleLoadError(source: string, error: unknown): ScheduleGridServerData {
  console.error(`Could not load ${source}:`, error)
  return { status: 'load_error' }
}

export async function loadScheduleGridData(
  searchParams?: Record<string, string | string[] | undefined>
): Promise<ScheduleGridServerData> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { status: 'unauthenticated' }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('role, shift_type, is_active, archived_at, site_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) return scheduleLoadError('schedule viewer profile', profileError)

  const profile = (profileData ?? null) as ViewerProfile | null
  const actorRole = parseRole(profile?.role)
  const permissionContext = {
    isActive: profile?.is_active !== false,
    archivedAt: profile?.archived_at ?? null,
  }

  if (
    !actorRole ||
    (!can(actorRole, 'access_lead_tools', permissionContext) && actorRole !== 'therapist')
  ) {
    return { status: 'forbidden' }
  }

  const rawShift = firstParam(searchParams?.shift)
  const initialShiftTab =
    parseCoverageShiftSearchParam(rawShift ?? null) ??
    defaultCoverageShiftTabFromProfileShift(profile?.shift_type)
  const shiftType = shiftTabToQueryValue(initialShiftTab)
  const canManageCoverage = can(actorRole, 'manage_coverage', permissionContext)
  const canUpdateAssignmentStatus = can(actorRole, 'update_assignment_status', permissionContext)

  const cyclesQuery = supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published, status, site_id')
    .is('archived_at', null)
    .order('start_date', { ascending: false })

  if (profile?.site_id) {
    cyclesQuery.eq('site_id', profile.site_id)
  }

  const { data: cyclesData, error: cyclesError } = await cyclesQuery

  if (cyclesError) return scheduleLoadError('schedule blocks', cyclesError)

  const cycles = (cyclesData ?? []) as CycleRow[]
  const cycleIdFromUrl = firstParam(searchParams?.cycle)
  const { visibleCycles, selectedCycle: cycle } = selectScheduleCycle({
    cycles,
    cycleIdFromUrl,
    canManageCoverage,
  })

  if (!cycle) return { status: 'no_cycle' }

  const cycleDates = dateRange(cycle.start_date, cycle.end_date)
  const isPublished = isCyclePublished(cycle)
  const interactionMode = resolveScheduleInteractionMode({
    canManageCoverage,
    canUpdateAssignmentStatus,
    isPublished,
  })

  const therapistQuery = supabase
    .from('profiles')
    .select(
      'id, full_name, shift_type, employment_type, on_fmla, is_active, archived_at, role, max_work_days_per_week'
    )
    .in('role', ['therapist', 'lead'])
    .is('archived_at', null)
    .order('full_name', { ascending: true })

  if (profile?.site_id) {
    therapistQuery.eq('site_id', profile.site_id)
  }

  const [
    { data: therapistsData, error: therapistsError },
    { data: shiftsData, error: shiftsError },
    { data: forceOffData, error: forceOffError },
  ] = await Promise.all([
    therapistQuery,
    supabase
      .from('shifts')
      .select('id, user_id, date, shift_type, status, assignment_status, role')
      .eq('cycle_id', cycle.id)
      .eq('shift_type', shiftType)
      .not('user_id', 'is', null),
    supabase
      .from('availability_overrides')
      .select('therapist_id, date, shift_type')
      .eq('cycle_id', cycle.id)
      .eq('override_type', 'force_off')
      .gte('date', cycle.start_date)
      .lte('date', cycle.end_date),
  ])

  if (therapistsError) return scheduleLoadError('schedule therapist roster', therapistsError)
  if (shiftsError) return scheduleLoadError('schedule shift assignments', shiftsError)
  if (forceOffError) return scheduleLoadError('schedule requested-off overrides', forceOffError)

  const shifts = (shiftsData ?? []) as ShiftRow[]
  const activeOperationalDetails = await fetchActiveOperationalDetailMap(
    supabase,
    shifts.map((shift) => shift.id)
  )
  const therapistRows = buildTherapistGridRows({
    therapists: (therapistsData ?? []) as TherapistRow[],
    cycleDates,
    shiftType,
    shifts,
    forceOffOverrides: (forceOffData ?? []) as ForceOffOverrideRow[],
    activeOperationalDetails,
  })

  const preFlightSummary =
    canManageCoverage && !isPublished ? await loadPreFlightSummary(cycle) : null

  return {
    status: 'ok',
    initialShiftTab,
    preFlightSummary,
    dataset: {
      cycleId: cycle.id,
      shiftType,
      interactionMode,
      availableCycles: buildAvailableCycleOptions(visibleCycles),
      cycleDates,
      cycleDateRangeLabel: formatHumanCycleRange(cycle.start_date, cycle.end_date),
      isPublished,
      therapistRows,
      dailyTotals: buildDailyTotals(therapistRows, cycleDates),
      viewerUserId: user.id,
      viewerRole: actorRole,
      canManageCoverage,
      canUpdateAssignmentStatus,
    },
  }

  async function loadPreFlightSummary(cycleForSummary: CycleRow) {
    const draftInputs = await loadDraftInputsForCycle(toDraftInputSupabaseClient(supabase), {
      cycle: {
        id: cycleForSummary.id,
        start_date: cycleForSummary.start_date,
        end_date: cycleForSummary.end_date,
        site_id: cycleForSummary.site_id,
      },
    })

    if (draftInputs.error) {
      console.error('Could not load schedule pre-flight summary:', draftInputs.error)
      return null
    }

    return shapePreFlightSummary(summarizePreFlight(generateDraftForCycle(draftInputs.data)))
  }
}
