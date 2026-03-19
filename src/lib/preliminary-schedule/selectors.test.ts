import { describe, expect, it } from 'vitest'

import {
  getActivePreliminarySnapshot,
  toManagerPreliminaryQueue,
  toPreliminaryShiftCard,
  toTherapistPreliminaryHistory,
} from '@/lib/preliminary-schedule/selectors'
import type {
  PreliminaryRequestRow,
  PreliminaryShiftRow,
  PreliminaryShiftStateRow,
  PreliminarySnapshotRow,
} from '@/lib/preliminary-schedule/types'

function makeSnapshot(overrides: Partial<PreliminarySnapshotRow> = {}): PreliminarySnapshotRow {
  return {
    id: 'snapshot-1',
    cycle_id: 'cycle-1',
    created_by: 'manager-1',
    sent_at: '2026-03-19T10:00:00.000Z',
    status: 'active',
    created_at: '2026-03-19T10:00:00.000Z',
    ...overrides,
  }
}

function makeShift(overrides: Partial<PreliminaryShiftRow> = {}): PreliminaryShiftRow {
  return {
    id: 'shift-1',
    cycle_id: 'cycle-1',
    user_id: 'therapist-1',
    date: '2026-03-22',
    shift_type: 'day',
    status: 'scheduled',
    role: 'staff',
    full_name: 'Barbara C.',
    ...overrides,
  }
}

function makeShiftState(
  overrides: Partial<PreliminaryShiftStateRow> = {}
): PreliminaryShiftStateRow {
  return {
    id: 'state-1',
    snapshot_id: 'snapshot-1',
    shift_id: 'shift-1',
    state: 'tentative_assignment',
    reserved_by: null,
    active_request_id: null,
    updated_at: '2026-03-19T10:00:00.000Z',
    ...overrides,
  }
}

function makeRequest(overrides: Partial<PreliminaryRequestRow> = {}): PreliminaryRequestRow {
  return {
    id: 'request-1',
    snapshot_id: 'snapshot-1',
    shift_id: 'shift-1',
    requester_id: 'therapist-1',
    type: 'request_change',
    status: 'pending',
    note: null,
    decision_note: null,
    approved_by: null,
    approved_at: null,
    created_at: '2026-03-19T10:00:00.000Z',
    requester_name: 'Barbara C.',
    ...overrides,
  }
}

describe('getActivePreliminarySnapshot', () => {
  it('returns the active snapshot when present', () => {
    const result = getActivePreliminarySnapshot([
      makeSnapshot({ id: 'snapshot-old', status: 'superseded' }),
      makeSnapshot({ id: 'snapshot-active', status: 'active' }),
    ])

    expect(result?.id).toBe('snapshot-active')
  })
})

describe('toPreliminaryShiftCard', () => {
  it('maps a claimed open shift to pending claim state', () => {
    const result = toPreliminaryShiftCard({
      shift: makeShift({ id: 'shift-open', user_id: null, full_name: null }),
      shiftState: makeShiftState({
        shift_id: 'shift-open',
        state: 'pending_claim',
        reserved_by: 'therapist-2',
        active_request_id: 'request-claim',
      }),
      currentUserId: 'therapist-1',
    })

    expect(result).toMatchObject({
      shiftId: 'shift-open',
      state: 'pending_claim',
      canClaim: false,
      canRequestChange: false,
      assignedName: null,
      reservedById: 'therapist-2',
      requestId: 'request-claim',
    })
  })

  it('allows request change only on the current user tentative assignment', () => {
    const result = toPreliminaryShiftCard({
      shift: makeShift({ user_id: 'therapist-1' }),
      shiftState: makeShiftState({ state: 'tentative_assignment' }),
      currentUserId: 'therapist-1',
    })

    expect(result.canRequestChange).toBe(true)
    expect(result.canClaim).toBe(false)
  })
})

describe('toTherapistPreliminaryHistory', () => {
  it('groups therapist history rows in reverse chronological order', () => {
    const result = toTherapistPreliminaryHistory(
      [
        makeRequest({
          id: 'request-newer',
          created_at: '2026-03-20T10:00:00.000Z',
          type: 'claim_open_shift',
          shift_id: 'shift-2',
        }),
        makeRequest({
          id: 'request-older',
          created_at: '2026-03-19T10:00:00.000Z',
          shift_id: 'shift-1',
        }),
      ],
      new Map<string, PreliminaryShiftRow>([
        ['shift-1', makeShift({ id: 'shift-1', date: '2026-03-22' })],
        [
          'shift-2',
          makeShift({ id: 'shift-2', date: '2026-03-23', user_id: null, full_name: null }),
        ],
      ])
    )

    expect(result.map((item) => item.id)).toEqual(['request-newer', 'request-older'])
    expect(result[0]).toMatchObject({
      requestType: 'claim_open_shift',
      shiftDate: '2026-03-23',
    })
  })
})

describe('toManagerPreliminaryQueue', () => {
  it('includes pending request detail for manager review', () => {
    const result = toManagerPreliminaryQueue(
      [
        makeRequest({
          id: 'request-queue',
          note: 'Can take this PRN shift',
          type: 'claim_open_shift',
        }),
      ],
      new Map<string, PreliminaryShiftRow>([
        ['shift-1', makeShift({ id: 'shift-1', date: '2026-03-24', shift_type: 'night' })],
      ])
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'request-queue',
      requestType: 'claim_open_shift',
      note: 'Can take this PRN shift',
      shiftDate: '2026-03-24',
      shiftType: 'night',
      requesterName: 'Barbara C.',
    })
  })
})
