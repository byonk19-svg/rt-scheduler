import { dateRange } from '@/lib/calendar-utils'
import type { AssignmentStatus, ShiftRole, ShiftStatus } from '@/lib/shift-types'
import {
  toCoverageUiStatus,
  type CoverageUiStatus,
} from '@/lib/coverage/status-ui'
import {
  evaluateStaffingSafety,
  STAFFING_MAXIMUM,
  STAFFING_MINIMUM,
  STAFFING_TARGET,
  type StaffingSafetyTone,
} from '@/lib/staffing-safety'

export type UiStatus = CoverageUiStatus
export type DayStatus = 'ok' | 'override' | 'missing_lead'
export type ShiftTab = 'Day' | 'Night'

export type ShiftLog = { from: string; to: UiStatus; toLabel: string; time: string }
export type ShiftItem = { id: string; userId: string; name: string; status: UiStatus; log: ShiftLog[] }
export type DayItem = {
  id: string
  isoDate: string
  date: number
  label: string
  dayStatus: DayStatus
  constraintBlocked: boolean
  leadShift: ShiftItem | null
  staffShifts: ShiftItem[]
}

/**
 * Minimal shape required by buildDayItems. Callers pre-resolve `name` from
 * the raw DB profile join so this module stays free of Supabase types.
 */
export type BuildDayRowInput = {
  id: string
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  role: ShiftRole
  status: ShiftStatus
  assignment_status: AssignmentStatus | null
  name: string
}

/**
 * Maps a flat list of assigned shift rows into an ordered DayItem[] spanning
 * the full cycle date range. Pure function — no React state, fully testable.
 */
export function buildDayItems(
  shiftType: 'day' | 'night',
  rows: BuildDayRowInput[],
  cycleStartDate: string,
  cycleEndDate: string,
  constraintBlockedSlotKeys: Set<string>
): DayItem[] {
  const byDate = new Map<string, BuildDayRowInput[]>()
  for (const row of rows) {
    if (row.shift_type !== shiftType) continue
    const bucket = byDate.get(row.date) ?? []
    bucket.push(row)
    byDate.set(row.date, bucket)
  }

  return dateRange(cycleStartDate, cycleEndDate).map((isoDate) => {
    const slot = (byDate.get(isoDate) ?? []).slice().sort((a, b) => {
      if (a.role !== b.role) return a.role === 'lead' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    const leadRow = slot.find((row) => row.role === 'lead') ?? null
    const leadShift: ShiftItem | null =
      leadRow === null
        ? null
        : {
            id: leadRow.id,
            userId: leadRow.user_id,
            name: leadRow.name,
            status: toUiStatus(leadRow.assignment_status, leadRow.status),
            log: [],
          }

    const staffShifts: ShiftItem[] = slot
      .filter((row) => row.id !== leadRow?.id)
      .map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        status: toUiStatus(row.assignment_status, row.status),
        log: [],
      }))

    const hasOverride = slot.some(
      (row) =>
        row.assignment_status === 'cancelled' ||
        row.assignment_status === 'call_in' ||
        row.status === 'called_off'
    )
    const dayStatus: DayStatus = !leadShift
      ? 'missing_lead'
      : hasOverride
        ? 'override'
        : 'ok'

    const date = new Date(`${isoDate}T00:00:00`)
    return {
      id: isoDate,
      isoDate,
      date: date.getDate(),
      label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      dayStatus,
      constraintBlocked: constraintBlockedSlotKeys.has(`${isoDate}:${shiftType}`),
      leadShift,
      staffShifts,
    } satisfies DayItem
  })
}

/**
 * Converts raw DB status fields to the single UiStatus used by the coverage UI.
 * Exported so callers can re-use the same mapping (e.g. optimistic updates).
 */
export function toUiStatus(assignment: AssignmentStatus | null, status: ShiftStatus): UiStatus {
  return toCoverageUiStatus(assignment, status)
}

export function flatten(day: DayItem): Array<ShiftItem & { isLead: boolean }> {
  const lead = day.leadShift ? [{ ...day.leadShift, isLead: true }] : []
  return [...lead, ...day.staffShifts.map((row) => ({ ...row, isLead: false }))]
}

export function countBy(day: DayItem, status: UiStatus): number {
  return flatten(day).filter((row) => row.status === status).length
}

export function countActive(day: DayItem): number {
  return getCoverageHealth(day).activeCount
}

export function countAssigned(day: DayItem): number {
  return flatten(day).length
}

export function shouldShowMonthTag(index: number, isoDate: string): boolean {
  const parsed = new Date(`${isoDate}T00:00:00`)
  return index === 0 || (!Number.isNaN(parsed.getTime()) && parsed.getDate() === 1)
}

export type HeadcountThreshold = 'red' | 'yellow' | 'green'
export type CoverageHealthTone = StaffingSafetyTone
export type CoverageHealth = {
  activeCount: number
  assignedCount: number
  activeLeadCount: number
  tone: CoverageHealthTone
  statusLabel: string
  activeStaffingLabel: string
  assignedRowsLabel: string
  showAssignedRowsContext: boolean
  missingLead: boolean
  callInCount: number
  cancelledCount: number
  onCallCount: number
  leftEarlyCount: number
  openToMinimum: number
  openToTarget: number
  overMaximum: number
  hasCoverageGap: boolean
  hasCallInGap: boolean
}
export const ACTIVE_STAFFING_TARGET = STAFFING_TARGET
export const ASSIGNED_ROWS_TARGET = STAFFING_MAXIMUM
export const COVERAGE_STAFFING_RULE_LABEL =
  `Lead required. Target is ${STAFFING_TARGET} active therapists; ${STAFFING_MINIMUM} active is a warning, fewer than ${STAFFING_MINIMUM} is critical.`
export const COVERAGE_OPERATIONAL_STATUS_RULE_LABEL =
  'Call In, On Call, and Cancelled remain visible but do not count as active staffing. Left Early remains visible and counts for the day.'

/**
 * PRD §9.3: Red < 3, Yellow = 3, Green >= 4.
 * Pass countActive(day) as the argument.
 */
export function headcountThreshold(activeCount: number): HeadcountThreshold {
  if (activeCount < STAFFING_MINIMUM) return 'red'
  if (activeCount === STAFFING_MINIMUM || activeCount > STAFFING_MAXIMUM) return 'yellow'
  return 'green'
}

export function getCoverageHealth(day: DayItem): CoverageHealth {
  const safety = evaluateStaffingSafety(
    flatten(day).map((row) => ({
      id: row.id,
      role: row.isLead ? 'lead' : 'staff',
      status:
        row.status === 'active'
          ? 'working'
          : row.status === 'oncall'
            ? 'on_call'
            : row.status === 'leave_early'
              ? 'left_early'
              : row.status,
    })),
    { constraintBlocked: day.constraintBlocked }
  )

  return {
    activeCount: safety.activeWorkingCount,
    assignedCount: safety.assignedCount,
    activeLeadCount: safety.activeLeadCount,
    tone: safety.tone,
    statusLabel: safety.label,
    activeStaffingLabel: safety.activeStaffingLabel,
    assignedRowsLabel: safety.assignedRowsLabel,
    showAssignedRowsContext: safety.assignedCount !== safety.activeWorkingCount,
    missingLead: safety.missingLead,
    callInCount: safety.callInCount,
    cancelledCount: safety.cancelledCount,
    onCallCount: safety.onCallCount,
    leftEarlyCount: safety.leftEarlyCount,
    openToMinimum: safety.openToMinimum,
    openToTarget: safety.openToTarget,
    overMaximum: safety.overMaximum,
    hasCoverageGap: safety.hasCoverageGap,
    hasCallInGap: safety.hasCallInGap,
  }
}
