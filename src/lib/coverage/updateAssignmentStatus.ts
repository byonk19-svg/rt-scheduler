import type { AssignmentStatus, ShiftStatus } from '@/app/schedule/types'

export type CoverageUiStatus = 'active' | 'oncall' | 'leave_early' | 'cancelled'

export type CoverageAssignmentPayload = {
  assignment_status: AssignmentStatus
  status: ShiftStatus
}

export type PersistCoverageAssignmentStatus = (
  shiftId: string,
  payload: CoverageAssignmentPayload
) => Promise<{ error: unknown | null }>

type UpdateCoverageAssignmentStatusOptions = {
  shiftId: string
  nextStatus: CoverageUiStatus
  persistAssignmentStatus: PersistCoverageAssignmentStatus
  applyOptimisticUpdate: () => void
  rollbackOptimisticUpdate: () => void
  clearError: () => void
  showError: (message: string) => void
  logError?: (message: string, error: unknown) => void
  failureMessage?: string
}

export function toAssignmentStatus(value: CoverageUiStatus): AssignmentStatus {
  if (value === 'oncall') return 'on_call'
  if (value === 'leave_early') return 'left_early'
  if (value === 'cancelled') return 'cancelled'
  return 'scheduled'
}

export function toShiftStatus(value: CoverageUiStatus): ShiftStatus {
  if (value === 'oncall') return 'on_call'
  if (value === 'cancelled') return 'called_off'
  return 'scheduled'
}

export async function updateCoverageAssignmentStatus({
  shiftId,
  nextStatus,
  persistAssignmentStatus,
  applyOptimisticUpdate,
  rollbackOptimisticUpdate,
  clearError,
  showError,
  logError,
  failureMessage = 'Could not save status update. Changes were rolled back.',
}: UpdateCoverageAssignmentStatusOptions): Promise<boolean> {
  clearError()
  applyOptimisticUpdate()

  const { error } = await persistAssignmentStatus(shiftId, {
    assignment_status: toAssignmentStatus(nextStatus),
    status: toShiftStatus(nextStatus),
  })

  if (!error) {
    return true
  }

  rollbackOptimisticUpdate()
  showError(failureMessage)

  if (logError) {
    logError('Failed to persist coverage status change:', error)
  } else {
    console.error('Failed to persist coverage status change:', error)
  }

  return false
}
