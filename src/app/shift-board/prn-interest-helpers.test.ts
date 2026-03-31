import { describe, expect, it } from 'vitest'

import { groupPickupsBySlot } from './prn-interest-helpers'
import type { ShiftBoardRequest } from './prn-interest-helpers'

function makeRequest(
  id: string,
  shiftId: string,
  postedAt: string,
  poster: string = 'Therapist'
): ShiftBoardRequest {
  return {
    id,
    type: 'pickup',
    poster,
    avatar: poster[0] ?? 'T',
    shift: 'Day Shift',
    shiftDate: '2026-04-01',
    shiftId,
    message: '',
    status: 'pending',
    posted: postedAt,
    postedAt,
    swapWithName: null,
    swapWithId: null,
    shiftType: 'day',
    shiftRole: 'staff',
    overrideReason: null,
  }
}

describe('groupPickupsBySlot', () => {
  it('groups pending pickup requests by shiftId', () => {
    const requests = [
      makeRequest('a', 'shift-1', '2026-04-01T08:00:00Z', 'Alice'),
      makeRequest('b', 'shift-1', '2026-04-01T09:00:00Z', 'Bob'),
      makeRequest('c', 'shift-2', '2026-04-01T07:00:00Z', 'Carol'),
    ]
    const groups = groupPickupsBySlot(requests)
    expect(groups).toHaveLength(2)
  })

  it('sorts candidates within a slot by postedAt ascending', () => {
    const requests = [
      makeRequest('late', 'shift-1', '2026-04-01T10:00:00Z', 'Late'),
      makeRequest('early', 'shift-1', '2026-04-01T08:00:00Z', 'Early'),
    ]
    const groups = groupPickupsBySlot(requests)
    expect(groups[0].candidates[0].id).toBe('early')
    expect(groups[0].candidates[1].id).toBe('late')
  })

  it('excludes non-pickup and non-pending requests', () => {
    const requests = [
      makeRequest('a', 'shift-1', '2026-04-01T08:00:00Z'),
      { ...makeRequest('b', 'shift-1', '2026-04-01T09:00:00Z'), type: 'swap' as const },
      { ...makeRequest('c', 'shift-1', '2026-04-01T10:00:00Z'), status: 'approved' as const },
    ]
    const groups = groupPickupsBySlot(requests)
    expect(groups).toHaveLength(1)
    expect(groups[0].candidates).toHaveLength(1)
  })

  it('only includes slots with 2 or more candidates in the multi-candidate result', () => {
    const requests = [
      makeRequest('a', 'shift-1', '2026-04-01T08:00:00Z'),
      makeRequest('b', 'shift-1', '2026-04-01T09:00:00Z'),
      makeRequest('c', 'shift-2', '2026-04-01T07:00:00Z'),
    ]
    const groups = groupPickupsBySlot(requests)
    const multiOnly = groups.filter((group) => group.candidates.length >= 2)
    expect(multiOnly).toHaveLength(1)
    expect(multiOnly[0].shiftId).toBe('shift-1')
  })
})
