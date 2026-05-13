import { MAX_SHIFT_COVERAGE_PER_DAY, MIN_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import type { AssignmentStatus, ShiftRole, ShiftStatus } from '@/lib/shift-types'

export const STAFFING_MINIMUM = MIN_SHIFT_COVERAGE_PER_DAY
export const STAFFING_TARGET = 4
export const STAFFING_MAXIMUM = MAX_SHIFT_COVERAGE_PER_DAY

export type StaffingSafetyStatus = 'working' | 'on_call' | 'cancelled' | 'call_in' | 'left_early'

export type StaffingSafetyTone = 'critical' | 'warning' | 'healthy'

export type StaffingSafetyRow = {
  id?: string
  role: ShiftRole
  status: StaffingSafetyStatus
}

export type StaffingSafetyResult = {
  assignedCount: number
  activeWorkingCount: number
  activeLeadCount: number
  missingLead: boolean
  callInCount: number
  cancelledCount: number
  onCallCount: number
  leftEarlyCount: number
  openToMinimum: number
  openToTarget: number
  overMaximum: number
  tone: StaffingSafetyTone
  label: string
  activeStaffingLabel: string
  assignedRowsLabel: string
  hasCoverageGap: boolean
  hasCallInGap: boolean
}

export function toStaffingSafetyStatus(args: {
  assignmentStatus?: AssignmentStatus | null
  shiftStatus?: ShiftStatus | null
}): StaffingSafetyStatus {
  if (args.assignmentStatus === 'on_call') return 'on_call'
  if (args.assignmentStatus === 'cancelled') return 'cancelled'
  if (args.assignmentStatus === 'call_in') return 'call_in'
  if (args.assignmentStatus === 'left_early') return 'left_early'
  if (args.shiftStatus === 'on_call') return 'on_call'
  if (args.shiftStatus === 'called_off' || args.shiftStatus === 'sick') return 'cancelled'
  return 'working'
}

export function countsAsActiveWorkingStatus(status: StaffingSafetyStatus): boolean {
  return status === 'working' || status === 'left_early'
}

export function satisfiesLeadRequirement(row: StaffingSafetyRow): boolean {
  return row.role === 'lead' && countsAsActiveWorkingStatus(row.status)
}

export function createsStaffingGapStatus(status: StaffingSafetyStatus): boolean {
  return status === 'call_in'
}

export function isVisibleNotWorkingStatus(status: StaffingSafetyStatus): boolean {
  return status === 'on_call' || status === 'cancelled' || status === 'call_in'
}

export function affectsLotteryHistoryStatus(status: AssignmentStatus): boolean {
  return status === 'on_call' || status === 'cancelled'
}

export function evaluateStaffingSafety(
  rows: StaffingSafetyRow[],
  options: { constraintBlocked?: boolean } = {}
): StaffingSafetyResult {
  const assignedCount = rows.length
  const activeWorkingCount = rows.filter((row) => countsAsActiveWorkingStatus(row.status)).length
  const activeLeadCount = rows.filter(satisfiesLeadRequirement).length
  const missingLead = activeLeadCount === 0
  const callInCount = rows.filter((row) => row.status === 'call_in').length
  const cancelledCount = rows.filter((row) => row.status === 'cancelled').length
  const onCallCount = rows.filter((row) => row.status === 'on_call').length
  const leftEarlyCount = rows.filter((row) => row.status === 'left_early').length
  const openToMinimum = Math.max(STAFFING_MINIMUM - activeWorkingCount, 0)
  const openToTarget = Math.max(STAFFING_TARGET - activeWorkingCount, 0)
  const overMaximum = Math.max(activeWorkingCount - STAFFING_MAXIMUM, 0)
  const hasCallInGap = callInCount > 0 && openToTarget > 0
  const hasCoverageGap = openToMinimum > 0 || hasCallInGap

  let tone: StaffingSafetyTone
  let label: string

  if (options.constraintBlocked) {
    tone = 'critical'
    label = 'No eligible therapists'
  } else if (assignedCount === 0) {
    tone = 'critical'
    label = 'Unstaffed'
  } else if (missingLead) {
    tone = 'critical'
    label = 'Missing lead'
  } else if (openToMinimum > 0) {
    tone = 'critical'
    label = hasCallInGap ? 'Call-in gap' : 'Understaffed'
  } else if (overMaximum > 0) {
    tone = 'warning'
    label = 'Overstaffed'
  } else if (openToTarget > 0) {
    tone = 'warning'
    label = 'Minimum staffed'
  } else {
    tone = 'healthy'
    label = 'Fully staffed'
  }

  return {
    assignedCount,
    activeWorkingCount,
    activeLeadCount,
    missingLead,
    callInCount,
    cancelledCount,
    onCallCount,
    leftEarlyCount,
    openToMinimum,
    openToTarget,
    overMaximum,
    tone,
    label,
    activeStaffingLabel: `${activeWorkingCount}/${STAFFING_TARGET} active staffing`,
    assignedRowsLabel: `${assignedCount}/${STAFFING_MAXIMUM} assigned rows`,
    hasCoverageGap,
    hasCallInGap,
  }
}
