import { formatHumanCycleRange } from '@/lib/calendar-utils'
import { getWeekBoundsForDate } from '@/lib/schedule-helpers'

import { isWorkingScheduledGridCell } from '@/components/schedule-grid/schedule-grid-utils'
import type {
  GridCell,
  ScheduleInteractionMode,
  ScheduleGridPreFlightSummary,
  TherapistGridRow,
} from '@/components/schedule-grid/schedule-grid-types'
import type { ActiveOperationalDetail } from '@/lib/operational-codes'
import { isPreliminaryScheduleBlock, isPublishedScheduleBlock } from '@/lib/schedule-block-state'
import { toScheduleGridCellStatus } from '@/lib/schedule/schedule-status-model'
import type { AssignmentStatus, ShiftStatus } from '@/lib/shift-types'

export type CycleRow = {
  id: string
  label: string | null
  start_date: string
  end_date: string
  published: boolean
  status: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
  site_id: string | null
}

export type TherapistRow = {
  id: string
  full_name: string | null
  shift_type: 'day' | 'night' | null
  employment_type: 'full_time' | 'part_time' | 'prn' | null
  on_fmla: boolean | null
  is_active: boolean | null
  is_lead_eligible?: boolean | null
  archived_at: string | null
  role: string | null
  max_work_days_per_week: number | null
}

export type ShiftRow = {
  id: string
  user_id: string | null
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  assignment_status: AssignmentStatus | null
  role: 'lead' | 'staff'
}

export type ForceOffOverrideRow = {
  therapist_id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
}

export function resolveScheduleInteractionMode({
  canManageCoverage,
  canUpdateAssignmentStatus,
  isPublished,
  viewMode = 'single_shift',
}: {
  canManageCoverage: boolean
  canUpdateAssignmentStatus: boolean
  isPublished: boolean
  viewMode?: 'single_shift' | 'combined'
}): ScheduleInteractionMode {
  if (viewMode === 'combined') {
    return {
      kind: 'combined_readonly',
      canUseManagerToolbar: false,
      canAssignShifts: false,
      canUnassignShifts: false,
      canDesignateLead: false,
      canUpdateAssignmentStatus: false,
    }
  }

  if (canManageCoverage) {
    return {
      kind: 'manager_edit',
      canUseManagerToolbar: true,
      canAssignShifts: true,
      canUnassignShifts: true,
      canDesignateLead: true,
      canUpdateAssignmentStatus: true,
    }
  }

  if (canUpdateAssignmentStatus && isPublished) {
    return {
      kind: 'lead_status',
      canUseManagerToolbar: false,
      canAssignShifts: false,
      canUnassignShifts: false,
      canDesignateLead: false,
      canUpdateAssignmentStatus: true,
    }
  }

  return {
    kind: 'staff_view',
    canUseManagerToolbar: false,
    canAssignShifts: false,
    canUnassignShifts: false,
    canDesignateLead: false,
    canUpdateAssignmentStatus: false,
  }
}

export function isCyclePublished(cycle: CycleRow): boolean {
  return isPublishedScheduleBlock(cycle)
}

function isCycleVisibleToStaff(cycle: CycleRow): boolean {
  return isCyclePublished(cycle) || isPreliminaryScheduleBlock(cycle)
}

export function selectScheduleCycle({
  cycles,
  cycleIdFromUrl,
  canManageCoverage,
}: {
  cycles: readonly CycleRow[]
  cycleIdFromUrl: string | undefined
  canManageCoverage: boolean
}): { visibleCycles: CycleRow[]; selectedCycle: CycleRow | null } {
  const visibleCycles = cycles.filter((cycle) =>
    canManageCoverage ? true : isCycleVisibleToStaff(cycle)
  )
  const selectedCycle =
    visibleCycles.find((candidate) => candidate.id === cycleIdFromUrl) ??
    visibleCycles.find((candidate) => !isCyclePublished(candidate)) ??
    visibleCycles.find((candidate) => isCyclePublished(candidate)) ??
    visibleCycles[0] ??
    null

  return { visibleCycles, selectedCycle }
}

export function buildAvailableCycleOptions(
  cycles: readonly CycleRow[]
): Array<{ id: string; label: string }> {
  return cycles.map((candidate) => ({
    id: candidate.id,
    label:
      candidate.label?.trim() || formatHumanCycleRange(candidate.start_date, candidate.end_date),
  }))
}

export function mapShiftToGridStatus({
  isLead,
  assignmentStatus,
  shiftStatus,
  operationalCode,
}: {
  isLead: boolean
  assignmentStatus: AssignmentStatus | null
  shiftStatus: ShiftStatus
  operationalCode: ActiveOperationalDetail['code'] | null
}): GridCell['status'] {
  return toScheduleGridCellStatus({ isLead, assignmentStatus, shiftStatus, operationalCode })
}

export function buildTherapistGridRows({
  therapists,
  cycleDates,
  shiftType,
  shifts,
  forceOffOverrides,
  activeOperationalDetails,
}: {
  therapists: readonly TherapistRow[]
  cycleDates: readonly string[]
  shiftType: 'day' | 'night'
  shifts: readonly ShiftRow[]
  forceOffOverrides: readonly ForceOffOverrideRow[]
  activeOperationalDetails: ReadonlyMap<string, ActiveOperationalDetail>
}): TherapistGridRow[] {
  const forceOffSet = buildForceOffSet(forceOffOverrides, shiftType)
  const shiftsByTherapistDate = buildShiftsByTherapistDate(shifts)

  return therapists
    .filter((therapist) => therapist.shift_type === shiftType)
    .map((therapist) => {
      const cells = buildTherapistCells({
        therapist,
        cycleDates,
        shiftsByTherapistDate,
        forceOffSet,
        activeOperationalDetails,
      })

      const row: TherapistGridRow = {
        userId: therapist.id,
        name: therapist.full_name?.trim() || 'Unknown',
        isOnFmla: therapist.on_fmla === true,
        isActive: isTherapistActiveForSchedule(therapist),
        isLeadEligible: therapist.is_lead_eligible === true,
        employmentType:
          therapist.employment_type === 'part_time' || therapist.employment_type === 'prn'
            ? therapist.employment_type
            : 'full_time',
        shiftType,
        cells,
      }

      markWeeklyMaxWorkDaysIneligibility({
        row,
        cycleDates,
        weeklyMax: therapist.max_work_days_per_week ?? 0,
      })
      return row
    })
}

function markWeeklyMaxWorkDaysIneligibility({
  row,
  cycleDates,
  weeklyMax,
}: {
  row: TherapistGridRow
  cycleDates: readonly string[]
  weeklyMax: number
}): void {
  if (weeklyMax <= 0) return

  const weekly = countWeekAssignments(row, cycleDates)
  for (const date of cycleDates) {
    const weekStart = weekly.dateToWeekStart.get(date)
    const cell = row.cells[date]
    if (cell?.status === 'off' && weekStart && (weekly.counts.get(weekStart) ?? 0) >= weeklyMax) {
      cell.isIneligible = true
      cell.ineligibleReason = cell.ineligibleReason ?? 'weekly_limit'
    }
  }
}

export function shapePreFlightSummary(
  summary: ScheduleGridPreFlightSummary
): ScheduleGridPreFlightSummary {
  return {
    unfilledSlots: summary.unfilledSlots,
    missingLeadSlots: summary.missingLeadSlots,
    forcedMustWorkMisses: summary.forcedMustWorkMisses,
    details: summary.details,
    readinessIssues: summary.readinessIssues,
  }
}

function buildTherapistCells({
  therapist,
  cycleDates,
  shiftsByTherapistDate,
  forceOffSet,
  activeOperationalDetails,
}: {
  therapist: TherapistRow
  cycleDates: readonly string[]
  shiftsByTherapistDate: ReadonlyMap<string, ShiftRow>
  forceOffSet: ReadonlySet<string>
  activeOperationalDetails: ReadonlyMap<string, ActiveOperationalDetail>
}): Record<string, GridCell> {
  const cells: Record<string, GridCell> = {}

  for (const date of cycleDates) {
    const shift = shiftsByTherapistDate.get(`${therapist.id}:${date}`)
    const hasNeedsOff = forceOffSet.has(`${therapist.id}:${date}`)

    if (shift) {
      const operationalCode = activeOperationalDetails.get(shift.id)?.code ?? null
      cells[date] = {
        shiftId: shift.id,
        status: mapShiftToGridStatus({
          isLead: shift.role === 'lead',
          operationalCode,
          assignmentStatus: shift.assignment_status,
          shiftStatus: shift.status,
        }),
        hasNeedsOff,
        isIneligible: false,
      }
    } else {
      const ineligibleReason = !isTherapistActiveForSchedule(therapist)
        ? 'inactive'
        : therapist.on_fmla === true
          ? 'fmla'
          : undefined
      cells[date] = {
        shiftId: null,
        status: 'off',
        hasNeedsOff,
        isIneligible: Boolean(ineligibleReason),
        ineligibleReason,
      }
    }
  }

  return cells
}

function isTherapistActiveForSchedule(therapist: TherapistRow): boolean {
  return therapist.is_active !== false && !therapist.archived_at
}

function buildForceOffSet(
  forceOffOverrides: readonly ForceOffOverrideRow[],
  shiftType: 'day' | 'night'
): Set<string> {
  return new Set(
    forceOffOverrides
      .filter((row) => row.shift_type === shiftType || row.shift_type === 'both')
      .map((row) => `${row.therapist_id}:${row.date}`)
  )
}

function buildShiftsByTherapistDate(shifts: readonly ShiftRow[]): Map<string, ShiftRow> {
  const shiftsByTherapistDate = new Map<string, ShiftRow>()
  for (const shift of shifts) {
    if (!shift.user_id) continue
    shiftsByTherapistDate.set(`${shift.user_id}:${shift.date}`, shift)
  }
  return shiftsByTherapistDate
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
