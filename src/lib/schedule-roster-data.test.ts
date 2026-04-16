import { describe, expect, it } from 'vitest'

import {
  buildAssignmentStoreFromShifts,
  buildAvailabilityApprovalStoreFromSubmittedOverrides,
} from '@/lib/schedule-roster-data'
import { createAssignmentKey } from '@/lib/mock-coverage-roster'

describe('buildAssignmentStoreFromShifts', () => {
  it('keys assignments by therapist, date, and shift type', () => {
    const store = buildAssignmentStoreFromShifts([
      { id: 'shift-1', user_id: 'u1', date: '2026-05-10', shift_type: 'day' },
    ])
    expect(store[createAssignmentKey('u1', '2026-05-10', 'day')]).toMatchObject({
      staffId: 'u1',
      isoDate: '2026-05-10',
      shiftType: 'day',
    })
  })
})

describe('buildAvailabilityApprovalStoreFromSubmittedOverrides', () => {
  it('applies both day and night keys when shift_type is both', () => {
    const submitted = new Set(['t1'])
    const store = buildAvailabilityApprovalStoreFromSubmittedOverrides(
      [
        {
          therapist_id: 't1',
          date: '2026-05-11',
          shift_type: 'both',
          override_type: 'force_off',
        },
      ],
      submitted
    )
    expect(store[createAssignmentKey('t1', '2026-05-11', 'day')]).toBe('approved_off')
    expect(store[createAssignmentKey('t1', '2026-05-11', 'night')]).toBe('approved_off')
  })

  it('ignores therapists who have not officially submitted for the cycle', () => {
    const store = buildAvailabilityApprovalStoreFromSubmittedOverrides(
      [
        {
          therapist_id: 't-draft',
          date: '2026-05-11',
          shift_type: 'day',
          override_type: 'force_on',
        },
      ],
      new Set()
    )
    expect(Object.keys(store)).toHaveLength(0)
  })
})
