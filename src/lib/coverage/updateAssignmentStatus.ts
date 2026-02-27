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

  const { error } = await persistAssignmentStatus(shiftId, {
    assignment_status: toAssignmentStatus(nextStatus),
    status: toShiftStatus(nextStatus),
  })

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
