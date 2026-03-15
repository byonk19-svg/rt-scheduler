import type { AssignmentStatus, ShiftStatus } from '@/lib/shift-types'

export type CoverageUiStatus = 'active' | 'oncall' | 'leave_early' | 'cancelled' | 'call_in'

export const COVERAGE_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'leave_early', label: 'Leave Early' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'call_in', label: 'Call In' },
  { value: 'oncall', label: 'On Call' },
] as const satisfies ReadonlyArray<{ value: CoverageUiStatus; label: string }>

const STATUS_LABELS: Record<CoverageUiStatus, string> = {
  active: 'Active',
  oncall: 'On Call',
  leave_early: 'Leave Early',
  cancelled: 'Cancelled',
  call_in: 'Call In',
}

export function getCoverageStatusLabel(value: CoverageUiStatus): string {
  return STATUS_LABELS[value]
}

export function toCoverageAssignmentPayload(value: CoverageUiStatus): {
  assignment_status: AssignmentStatus
  status: ShiftStatus
} {
  if (value === 'oncall') return { assignment_status: 'on_call', status: 'on_call' }
  if (value === 'leave_early') return { assignment_status: 'left_early', status: 'scheduled' }
  if (value === 'cancelled') return { assignment_status: 'cancelled', status: 'called_off' }
  if (value === 'call_in') return { assignment_status: 'call_in', status: 'called_off' }
  return { assignment_status: 'scheduled', status: 'scheduled' }
}

export function toCoverageUiStatus(
  assignment: AssignmentStatus | null,
  status: ShiftStatus
): CoverageUiStatus {
  if (assignment === 'on_call') return 'oncall'
  if (assignment === 'left_early') return 'leave_early'
  if (assignment === 'cancelled') return 'cancelled'
  if (assignment === 'call_in') return 'call_in'
  if (assignment === 'scheduled') return 'active'
  if (status === 'on_call') return 'oncall'
  if (status === 'called_off') return 'cancelled'
  if (status === 'sick') return 'cancelled'
  return 'active'
}
