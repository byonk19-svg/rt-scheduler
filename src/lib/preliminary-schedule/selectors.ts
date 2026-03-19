import type {
  ManagerPreliminaryQueueItem,
  PreliminaryHistoryItem,
  PreliminaryRequestRow,
  PreliminaryShiftCard,
  PreliminaryShiftRow,
  PreliminaryShiftState,
  PreliminaryShiftStateRow,
  PreliminarySnapshotRow,
} from '@/lib/preliminary-schedule/types'

export function getActivePreliminarySnapshot(
  snapshots: PreliminarySnapshotRow[]
): PreliminarySnapshotRow | null {
  return snapshots.find((snapshot) => snapshot.status === 'active') ?? null
}

export function toPreliminaryStateFromShift(shift: PreliminaryShiftRow): PreliminaryShiftState {
  return shift.user_id ? 'tentative_assignment' : 'open'
}

export function toPreliminaryShiftCard(params: {
  shift: PreliminaryShiftRow
  shiftState: PreliminaryShiftStateRow
  currentUserId?: string | null
}): PreliminaryShiftCard {
  const { shift, shiftState, currentUserId = null } = params
  const canClaim = shiftState.state === 'open'
  const canRequestChange =
    shiftState.state === 'tentative_assignment' &&
    Boolean(currentUserId) &&
    shift.user_id === currentUserId

  return {
    shiftId: shift.id,
    shiftDate: shift.date,
    shiftType: shift.shift_type,
    shiftRole: shift.role,
    assignedUserId: shift.user_id,
    assignedName: shift.full_name,
    state: shiftState.state,
    reservedById: shiftState.reserved_by,
    requestId: shiftState.active_request_id,
    canClaim,
    canRequestChange,
  }
}

export function toTherapistPreliminaryHistory(
  requests: PreliminaryRequestRow[],
  shiftsById: Map<string, PreliminaryShiftRow>
): PreliminaryHistoryItem[] {
  return [...requests]
    .sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    )
    .map((request) => {
      const shift = shiftsById.get(request.shift_id)

      return {
        id: request.id,
        requestId: request.id,
        shiftId: request.shift_id,
        shiftDate: shift?.date ?? '',
        shiftType: shift?.shift_type ?? 'day',
        requestType: request.type,
        status: request.status,
        note: request.note,
        createdAt: request.created_at,
      }
    })
}

export function toManagerPreliminaryQueue(
  requests: PreliminaryRequestRow[],
  shiftsById: Map<string, PreliminaryShiftRow>
): ManagerPreliminaryQueueItem[] {
  return requests
    .filter((request) => request.status === 'pending')
    .sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    )
    .map((request) => {
      const shift = shiftsById.get(request.shift_id)

      return {
        id: request.id,
        shiftId: request.shift_id,
        shiftDate: shift?.date ?? '',
        shiftType: shift?.shift_type ?? 'day',
        requesterId: request.requester_id,
        requesterName: request.requester_name ?? 'Unknown',
        requestType: request.type,
        status: request.status,
        note: request.note,
        createdAt: request.created_at,
      }
    })
}
