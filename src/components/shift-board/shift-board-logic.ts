import {
  HISTORY_STATUSES,
  type RequestStatus,
  type RequestType,
  type ShiftBoardRequest,
} from '@/components/shift-board/types'

export function filterShiftBoardRequests(params: {
  activeTab: 'open' | 'history'
  currentUserId: string | null
  isStaffRole: boolean
  requests: ShiftBoardRequest[]
  scope: 'mine' | 'all'
  search: string
  statusFilter: 'all' | 'pending' | 'approved' | 'denied'
  typeFilter: 'all' | RequestType
}): ShiftBoardRequest[] {
  const normalizedSearch = params.search.trim().toLowerCase()
  const scopedRequests =
    params.isStaffRole && params.scope === 'mine' && params.currentUserId
      ? params.requests.filter(
          (request) =>
            request.postedById === params.currentUserId ||
            request.claimedById === params.currentUserId
        )
      : params.requests

  return scopedRequests.filter((request) => {
    if (params.activeTab === 'history' && !HISTORY_STATUSES.includes(request.status)) {
      return false
    }

    if (
      params.activeTab === 'open' &&
      request.status === 'expired' &&
      params.statusFilter !== 'all'
    ) {
      return false
    }

    const matchesStatus = params.statusFilter === 'all' || request.status === params.statusFilter
    if (!matchesStatus) return false

    const matchesType = params.typeFilter === 'all' || request.type === params.typeFilter
    if (!matchesType) return false

    if (normalizedSearch.length === 0) return true

    const haystack = `${request.poster} ${request.message} ${request.shift}`.toLowerCase()
    return haystack.includes(normalizedSearch)
  })
}

export function getShiftBoardActionErrorMessage(message: string): string {
  if (message.includes('no swap partner assigned')) {
    return 'Cannot approve: this swap request has no partner assigned. Select a swap partner first.'
  }
  if (message.includes('shifts_unique_cycle_user_date')) {
    return 'Cannot approve: the selected swap partner is already scheduled on this date.'
  }
  if (message.includes('partner shift type mismatch')) {
    return 'Cannot approve: swap partners must be scheduled on the same shift type.'
  }
  if (message.includes('operational code')) {
    return 'Cannot approve: shifts with active operational codes are locked from swaps.'
  }
  if (message.includes('is not working')) {
    return 'Cannot approve: both swap partners must have working scheduled shifts.'
  }
  if (message.includes('Lead coverage gap')) {
    return 'override:Lead coverage gap - approving this request would leave a shift without a lead. You can force-approve below.'
  }
  if (message.includes('Double booking')) {
    return 'Cannot approve: double booking. This therapist is already assigned to this shift.'
  }
  return `Could not save: ${message}`
}

export function countRequestsByStatus(
  requests: ShiftBoardRequest[],
  status: RequestStatus
): number {
  return requests.filter((request) => request.status === status).length
}
