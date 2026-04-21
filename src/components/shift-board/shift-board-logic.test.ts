import { describe, expect, it } from 'vitest'

import {
  countRequestsByStatus,
  filterShiftBoardRequests,
  getShiftBoardActionErrorMessage,
} from '@/components/shift-board/shift-board-logic'
import type { ShiftBoardRequest } from '@/components/shift-board/types'

const sampleRequests: ShiftBoardRequest[] = [
  {
    id: '1',
    type: 'swap',
    poster: 'Aleyce',
    postedById: 'user-1',
    avatar: 'AL',
    shift: 'Mon - Day',
    shiftDate: '2026-05-01',
    shiftId: 'shift-1',
    message: 'Need a swap',
    status: 'pending',
    posted: 'today',
    postedAt: '2026-05-01T00:00:00.000Z',
    swapWithName: null,
    swapWithId: null,
    claimedById: null,
    shiftType: 'day',
    shiftRole: 'staff',
    overrideReason: null,
  },
  {
    id: '2',
    type: 'pickup',
    poster: 'Barbara',
    postedById: 'user-2',
    avatar: 'BA',
    shift: 'Tue - Night',
    shiftDate: '2026-05-02',
    shiftId: 'shift-2',
    message: 'Pickup please',
    status: 'approved',
    posted: 'yesterday',
    postedAt: '2026-05-02T00:00:00.000Z',
    swapWithName: null,
    swapWithId: null,
    claimedById: 'user-1',
    shiftType: 'night',
    shiftRole: 'staff',
    overrideReason: null,
  },
]

describe('shift-board-logic', () => {
  it('filters requests by staff scope and tab', () => {
    const filtered = filterShiftBoardRequests({
      activeTab: 'history',
      currentUserId: 'user-1',
      isStaffRole: true,
      requests: sampleRequests,
      scope: 'mine',
      search: '',
      statusFilter: 'all',
      typeFilter: 'all',
    })

    expect(filtered.map((request) => request.id)).toEqual(['2'])
  })

  it('maps known approval failure messages to user-facing copy', () => {
    expect(getShiftBoardActionErrorMessage('Lead coverage gap')).toContain('override:')
    expect(getShiftBoardActionErrorMessage('operational code')).toContain('locked from swaps')
  })

  it('counts request statuses', () => {
    expect(countRequestsByStatus(sampleRequests, 'pending')).toBe(1)
    expect(countRequestsByStatus(sampleRequests, 'approved')).toBe(1)
  })
})
