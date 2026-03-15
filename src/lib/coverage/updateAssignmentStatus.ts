import {
  toCoverageAssignmentPayload,
  type CoverageUiStatus,
} from '@/lib/coverage/status-ui'

export type CoverageAssignmentPayload = {
  assignment_status: import('@/lib/shift-types').AssignmentStatus
  status: import('@/lib/shift-types').ShiftStatus
}

export type PersistCoverageAssignmentStatus = (
  shiftId: string,
  payload: CoverageAssignmentPayload
) => Promise<{ error: unknown | null }>

export type CoverageStateUpdater<TState> = (current: TState) => TState

type UpdateCoverageAssignmentStatusOptions<TState> = {
  shiftId: string
  nextStatus: CoverageUiStatus
  setState: (updater: CoverageStateUpdater<TState>) => void
  persistAssignmentStatus: PersistCoverageAssignmentStatus
  applyOptimisticUpdate: CoverageStateUpdater<TState>
  rollbackOptimisticUpdate: CoverageStateUpdater<TState>
  clearError: () => void
  showError: (message: string) => void
  logError?: (message: string, error: unknown) => void
  failureMessage?: string
}

export async function updateCoverageAssignmentStatus<TState>({
  shiftId,
  nextStatus,
  setState,
  persistAssignmentStatus,
  applyOptimisticUpdate,
  rollbackOptimisticUpdate,
  clearError,
  showError,
  logError,
  failureMessage = 'Could not save status update. Changes were rolled back.',
}: UpdateCoverageAssignmentStatusOptions<TState>): Promise<boolean> {
  clearError()
  setState(applyOptimisticUpdate)

  const payload = toCoverageAssignmentPayload(nextStatus)

  const { error } = await persistAssignmentStatus(shiftId, payload)

  if (!error) {
    return true
  }

  setState(rollbackOptimisticUpdate)
  showError(failureMessage)

  if (logError) {
    logError('Failed to persist coverage status change:', error)
  } else {
    console.error('Failed to persist coverage status change:', error)
  }

  return false
}
