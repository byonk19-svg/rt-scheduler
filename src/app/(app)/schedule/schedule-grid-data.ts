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
import { getWeekBoundsForDate } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/server'

import {
  buildDailyTotals,
  isWorkingScheduledGridCell,
} from '@/components/schedule-grid/schedule-grid-utils'
import type {
  GridCell,
  GridDataset,
  ScheduleGridPreFlightSummary,
  TherapistGridRow,
} from '@/components/schedule-grid/schedule-grid-types'
import type { AssignmentStatus, ShiftStatus } from '@/lib/shift-types'

type CycleRow = {
  id: string
  label: string | null
  start_date: string
  end_date: string
  published: boolean
  status: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
  site_id: string | null
}

type ViewerProfile = {
  role: Role | null
  shift_type: 'day' | 'night' | null
  is_active: boolean | null
  archived_at: string | null
  site_id: string | null
}

type TherapistRow = {
  id: string
  full_name: string | null
  shift_type: 'day' | 'night' | null
  employment_type: 'full_time' | 'part_time' | 'prn' | null
  on_fmla: boolean | null
  is_active: boolean | null
  archived_at: string | null
  role: Role | null
  max_work_days_per_week: number | null
}

type ShiftRow = {
  id: string
  user_id: string | null
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  assignment_status: AssignmentStatus | null
  role: 'lead' | 'staff'
}

type ForceOffOverrideRow = {
  therapist_id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
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

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function assignmentStatusToGridStatus(
  isLead: boolean,
  assignmentStatus: AssignmentStatus | null,
  shiftStatus: ShiftStatus
): GridCell['status'] {
  if (assignmentStatus === 'on_call' || shiftStatus === 'on_call') return 'on_call'
  if (assignmentStatus === 'cancelled') return 'cancelled'
  if (assignmentStatus === 'call_in') return 'call_in'
  if (assignmentStatus === 'left_early') return 'left_early'
  if (shiftStatus === 'called_off') return 'cancelled'
  return isLead ? 'lead' : 'staff'
}

function countWeekAssignments(row: TherapistGridRow, cycleDates: readonly string[]) {
  const counts = new Map<string, number>()
  const dateToWeekStart = new Map<string, string>()

  for (const date of cycleDates) {
    const weekStart = getWeekBoundsForDate(date)?.weekStart
    if (!weekStart) continue
    dateToWeekStart.set(date, weekStart)
    if (isWorkingScheduledGridCell(row.cells[date])) {
      counts.set(weekStart, (counts.get(weekStart) ?? 0) + 1)
    }
  }

  return { counts, dateToWeekStart }
}

function isCyclePublished(cycle: CycleRow) {
  return cycle.published || cycle.status === 'final'
}

export async function loadScheduleGridData(
  searchParams?: Record<string, string | string[] | undefined>
): Promise<ScheduleGridServerData> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { status: 'unauthenticated' }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, shift_type, is_active, archived_at, site_id')
    .eq('id', user.id)
    .maybeSingle()

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

  const { data: cyclesData } = await cyclesQuery

  const cycles = ((cyclesData ?? []) as CycleRow[]).filter((cycle) =>
    canManageCoverage ? true : isCyclePublished(cycle)
  )
  const cycleIdFromUrl = firstParam(searchParams?.cycle)
  const cycle =
    cycles.find((candidate) => candidate.id === cycleIdFromUrl) ??
    cycles.find((candidate) => !isCyclePublished(candidate)) ??
    cycles.find((candidate) => isCyclePublished(candidate)) ??
    cycles[0] ??
    null

  if (!cycle) return { status: 'no_cycle' }

  const cycleDates = dateRange(cycle.start_date, cycle.end_date)
  const isPublished = isCyclePublished(cycle)

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

  const [{ data: therapistsData }, { data: shiftsData }, { data: forceOffData }] =
    await Promise.all([
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

  const shifts = (shiftsData ?? []) as ShiftRow[]
  const activeOperationalDetails = await fetchActiveOperationalDetailMap(
    supabase,
    shifts.map((shift) => shift.id)
  )
  const forceOffSet = new Set(
    ((forceOffData ?? []) as ForceOffOverrideRow[])
      .filter((row) => row.shift_type === shiftType || row.shift_type === 'both')
      .map((row) => `${row.therapist_id}:${row.date}`)
  )
  const shiftsByTherapistDate = new Map<string, ShiftRow>()
  for (const shift of shifts) {
    if (!shift.user_id) continue
    shiftsByTherapistDate.set(`${shift.user_id}:${shift.date}`, shift)
  }

  const therapistRows: TherapistGridRow[] = ((therapistsData ?? []) as TherapistRow[])
    .filter((therapist) => therapist.shift_type === shiftType)
    .map((therapist) => {
      const cells: Record<string, GridCell> = {}

      for (const date of cycleDates) {
        const shift = shiftsByTherapistDate.get(`${therapist.id}:${date}`)
        const hasNeedsOff = forceOffSet.has(`${therapist.id}:${date}`)

        if (shift) {
          const operationalCode = activeOperationalDetails.get(shift.id)?.code ?? null
          cells[date] = {
            shiftId: shift.id,
            status: assignmentStatusToGridStatus(
              shift.role === 'lead',
              operationalCode ?? shift.assignment_status,
              shift.status
            ),
            hasNeedsOff,
            isIneligible: false,
          }
        } else {
          cells[date] = {
            shiftId: null,
            status: 'off',
            hasNeedsOff,
            isIneligible: therapist.is_active === false || therapist.on_fmla === true,
          }
        }
      }

      const row: TherapistGridRow = {
        userId: therapist.id,
        name: therapist.full_name?.trim() || 'Unknown',
        isOnFmla: therapist.on_fmla === true,
        isActive: therapist.is_active !== false,
        employmentType:
          therapist.employment_type === 'part_time' || therapist.employment_type === 'prn'
            ? therapist.employment_type
            : 'full_time',
        shiftType: shiftType,
        cells,
      }
      const weekly = countWeekAssignments(row, cycleDates)
      const weeklyMax = therapist.max_work_days_per_week ?? 0
      if (weeklyMax > 0) {
        for (const date of cycleDates) {
          const weekStart = weekly.dateToWeekStart.get(date)
          const cell = row.cells[date]
          if (
            cell?.status === 'off' &&
            weekStart &&
            (weekly.counts.get(weekStart) ?? 0) >= weeklyMax
          ) {
            cell.isIneligible = true
          }
        }
      }
      return row
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
      availableCycles: cycles.map((candidate) => ({
        id: candidate.id,
        label:
          candidate.label?.trim() ||
          formatHumanCycleRange(candidate.start_date, candidate.end_date),
      })),
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

    return summarizePreFlight(generateDraftForCycle(draftInputs.data))
  }
}
