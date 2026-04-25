import type {
  ManagerPreliminaryQueueItem,
  PreliminaryDirectEditAction,
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
  reservedByName?: string | null
  currentUserId?: string | null
  currentUserShiftType?: 'day' | 'night' | null
}): PreliminaryShiftCard {
  const {
    shift,
    shiftState,
    reservedByName = null,
    currentUserId = null,
    currentUserShiftType = null,
  } = params
  const canClaim = shiftState.state === 'open'
  const canRequestChange =
    shiftState.state === 'tentative_assignment' &&
    Boolean(currentUserId) &&
    shift.user_id === currentUserId
  const isCurrentUser = Boolean(currentUserId) && shift.user_id === currentUserId
  const isPreferredShift = currentUserShiftType != null && shift.shift_type === currentUserShiftType
  let directAction: PreliminaryDirectEditAction | null = null
  let directActionLabel: string | null = null

  if (isCurrentUser && shiftState.state === 'tentative_assignment') {
    directAction = 'remove_me'
    directActionLabel = 'Remove me'
  } else if (
    !isCurrentUser &&
    isPreferredShift &&
    (shiftState.state === 'open' || shiftState.state === 'tentative_assignment')
  ) {
    directAction = 'add_here'
    directActionLabel = shiftState.state === 'open' ? "I'll take this" : 'Add me here'
  } else if (
    !isCurrentUser &&
    currentUserShiftType != null &&
    shift.shift_type !== currentUserShiftType &&
    shiftState.state === 'open'
  ) {
    directAction = 'express_interest'
    directActionLabel = 'Express interest'
  }

  return {
    shiftId: shift.id,
    shiftDate: shift.date,
    shiftType: shift.shift_type,
    shiftRole: shift.role,
    assignedUserId: shift.user_id,
    assignedName:
      shiftState.state === 'pending_claim' && !shift.full_name ? reservedByName : shift.full_name,
    state: shiftState.state,
    reservedById: shiftState.reserved_by,
    reservedByName,
    requestId: shiftState.active_request_id,
    canClaim,
    canRequestChange,
    directAction,
    directActionLabel,
  }
}

export function toTherapistPreliminaryHistory(
  requests: PreliminaryRequestRow[],
  shiftsById: Map<string, PreliminaryShiftRow>,
  requesterShiftTypesById: Map<string, 'day' | 'night' | null> = new Map()
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
        isOppositeShiftRequest:
          request.type === 'claim_open_shift' &&
          Boolean(requesterShiftTypesById.get(request.requester_id)) &&
          requesterShiftTypesById.get(request.requester_id) !== (shift?.shift_type ?? null),
        status: request.status,
        note: request.note,
        createdAt: request.created_at,
      }
    })
}

export function toManagerPreliminaryQueue(
  requests: PreliminaryRequestRow[],
  shiftsById: Map<string, PreliminaryShiftRow>,
  requesterShiftTypesById: Map<string, 'day' | 'night' | null> = new Map()
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
        isOppositeShiftRequest:
          request.type === 'claim_open_shift' &&
          Boolean(requesterShiftTypesById.get(request.requester_id)) &&
          requesterShiftTypesById.get(request.requester_id) !== (shift?.shift_type ?? null),
        status: request.status,
        note: request.note,
        createdAt: request.created_at,
      }
    })
}
