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
import { buildReadinessIssues } from '@/lib/coverage/readiness-issues'
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

type ScheduleBlockShiftLookupRow = {
  id: string
  date: string
  shift_type: 'day' | 'night'
}

type ScheduleBlockShiftPostRow = {
  id: string
  type: string | null
  shift_id: string | null
  swap_shift_id: string | null
}

export type ScheduleGridServerData =
  | {
      status: 'ok'
      dataset: GridDataset
      initialShiftTab: 'Day' | 'Night'
      preFlightSummary: ScheduleGridPreFlightSummary | null
    }
  | { status: 'unauthenticated' }
  | { status: 'inactive' }
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

function filterScheduleTherapistsForCycle({
  therapists,
  shifts,
  isPublished,
}: {
  therapists: readonly TherapistRow[]
  shifts: readonly ShiftRow[]
  isPublished: boolean
}): TherapistRow[] {
  if (isPublished) return [...therapists]

  const assignedTherapistIds = new Set(
    shifts.map((shift) => shift.user_id).filter((userId): userId is string => Boolean(userId))
  )

  return therapists.filter((therapist) => {
    if (therapist.archived_at) return assignedTherapistIds.has(therapist.id)
    if (isPublished) return true
    if (therapist.is_active === false) return assignedTherapistIds.has(therapist.id)
    return true
  })
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

  if (profile?.is_active === false || profile?.archived_at) {
    return { status: 'inactive' }
  }

  if (!actorRole || (!can(actorRole, 'access_lead_tools') && actorRole !== 'therapist')) {
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
      'id, full_name, shift_type, employment_type, on_fmla, is_active, is_lead_eligible, archived_at, role, max_work_days_per_week'
    )
    .in('role', ['therapist', 'lead'])
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
  if (forceOffError) return scheduleLoadError('schedule Need Off overrides', forceOffError)

  const shifts = (shiftsData ?? []) as ShiftRow[]
  const scheduleTherapists = filterScheduleTherapistsForCycle({
    therapists: (therapistsData ?? []) as TherapistRow[],
    shifts,
    isPublished,
  })
  const activeOperationalDetails = await fetchActiveOperationalDetailMap(
    supabase,
    shifts.map((shift) => shift.id)
  )
  const therapistRows = buildTherapistGridRows({
    therapists: scheduleTherapists,
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
      cycleStatus: cycle.status,
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
      therapistScope: 'active-non-fmla',
    })

    if (draftInputs.error) {
      console.error('Could not load schedule pre-flight summary:', draftInputs.error)
      return null
    }

    const { data: submissionData, error: submissionError } = await supabase
      .from('therapist_availability_submissions')
      .select('therapist_id')
      .eq('schedule_cycle_id', cycleForSummary.id)

    if (submissionError) {
      console.error(
        'Could not load availability submissions for pre-flight summary:',
        submissionError
      )
      return null
    }

    const openShiftBoardRequests = await loadOpenShiftBoardRequestsForCycle(cycleForSummary.id)

    if (openShiftBoardRequests.error) {
      console.error(
        'Could not load open Shift Board requests for pre-flight summary:',
        openShiftBoardRequests.error
      )
      return null
    }

    const preFlightResult = generateDraftForCycle(draftInputs.data)
    return shapePreFlightSummary({
      ...summarizePreFlight(preFlightResult),
      readinessIssues: buildReadinessIssues(preFlightResult, {
        openShiftBoardRequests: openShiftBoardRequests.data,
        missingAvailabilitySubmissions: {
          expectedTherapists: draftInputs.data.therapists.map((therapist) => ({
            id: therapist.id,
            fullName: therapist.full_name,
          })),
          submittedTherapistIds: ((submissionData ?? []) as Array<{ therapist_id: string }>).map(
            (submission) => submission.therapist_id
          ),
          availabilityProvidedTherapistIds: draftInputs.data.allAvailabilityOverrides.map(
            (override) => override.therapist_id
          ),
        },
      }),
    })
  }

  async function loadOpenShiftBoardRequestsForCycle(cycleId: string) {
    const { data: shiftData, error: shiftError } = await supabase
      .from('shifts')
      .select('id, date, shift_type')
      .eq('cycle_id', cycleId)

    if (shiftError) {
      return { data: [], error: shiftError }
    }

    const shifts = (shiftData ?? []) as ScheduleBlockShiftLookupRow[]
    const shiftIds = shifts.map((shift) => shift.id).filter(Boolean)

    if (shiftIds.length === 0) {
      return { data: [], error: null }
    }

    const shiftById = new Map(shifts.map((shift) => [shift.id, shift]))
    const postColumns = 'id, type, shift_id, swap_shift_id'
    const [primaryPostResult, swapPostResult] = await Promise.all([
      supabase
        .from('shift_posts')
        .select(postColumns)
        .eq('status', 'pending')
        .in('shift_id', shiftIds),
      supabase
        .from('shift_posts')
        .select(postColumns)
        .eq('status', 'pending')
        .in('swap_shift_id', shiftIds),
    ])

    if (primaryPostResult.error || swapPostResult.error) {
      return { data: [], error: primaryPostResult.error ?? swapPostResult.error }
    }

    const postsById = new Map<string, ScheduleBlockShiftPostRow>()

    for (const row of [
      ...((primaryPostResult.data ?? []) as ScheduleBlockShiftPostRow[]),
      ...((swapPostResult.data ?? []) as ScheduleBlockShiftPostRow[]),
    ]) {
      if (row.id) postsById.set(row.id, row)
    }

    return {
      data: Array.from(postsById.values()).map((post) => {
        const targetShift =
          (post.shift_id ? shiftById.get(post.shift_id) : undefined) ??
          (post.swap_shift_id ? shiftById.get(post.swap_shift_id) : undefined)

        return {
          id: post.id,
          requestType: post.type === 'swap' ? ('trade' as const) : ('coverage' as const),
          date: targetShift?.date ?? null,
          shiftType: targetShift?.shift_type ?? null,
        }
      }),
      error: null,
    }
  }
}
