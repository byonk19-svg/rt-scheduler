import type { AssignmentStatus, ShiftStatus } from '@/lib/shift-types'
import type { OperationalCode } from '@/lib/operational-codes'

export type ScheduleGridCellStatus =
  | 'lead'
  | 'staff'
  | 'on_call'
  | 'cancelled'
  | 'call_in'
  | 'left_early'
  | 'off'

const SCHEDULE_GRID_ASSIGNMENT_STATUS_VALUES = [
  'scheduled',
  'call_in',
  'cancelled',
  'on_call',
  'left_early',
] as const satisfies ReadonlyArray<AssignmentStatus>

export type ScheduleGridAssignmentStatus = (typeof SCHEDULE_GRID_ASSIGNMENT_STATUS_VALUES)[number]

export function isScheduleGridAssignmentStatus(
  value: string
): value is ScheduleGridAssignmentStatus {
  return SCHEDULE_GRID_ASSIGNMENT_STATUS_VALUES.includes(value as ScheduleGridAssignmentStatus)
}

export function toScheduleGridCellStatus({
  isLead,
  assignmentStatus,
  shiftStatus,
  operationalCode,
}: {
  isLead: boolean
  assignmentStatus: AssignmentStatus | null
  shiftStatus: ShiftStatus
  operationalCode: OperationalCode | null
}): ScheduleGridCellStatus {
  const effectiveAssignmentStatus = operationalCode ?? assignmentStatus
  if (effectiveAssignmentStatus === 'on_call' || shiftStatus === 'on_call') return 'on_call'
  if (effectiveAssignmentStatus === 'cancelled') return 'cancelled'
  if (effectiveAssignmentStatus === 'call_in') return 'call_in'
  if (effectiveAssignmentStatus === 'left_early') return 'left_early'
  if (shiftStatus === 'called_off') return 'cancelled'
  return isLead ? 'lead' : 'staff'
}

export function toScheduleGridMutationPayload(value: string | null | undefined): {
  assignment_status: AssignmentStatus
  status: ShiftStatus
} {
  if (value === 'on_call') return { assignment_status: 'on_call', status: 'on_call' }
  if (value === 'cancelled') return { assignment_status: 'cancelled', status: 'called_off' }
  if (value === 'call_in') return { assignment_status: 'call_in', status: 'called_off' }
  if (value === 'left_early') return { assignment_status: 'left_early', status: 'scheduled' }
  return { assignment_status: 'scheduled', status: 'scheduled' }
}

export function toScheduleGridAssignmentStatus(
  status: ScheduleGridCellStatus
): ScheduleGridAssignmentStatus {
  if (status === 'on_call') return 'on_call'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'call_in') return 'call_in'
  if (status === 'left_early') return 'left_early'
  return 'scheduled'
}
