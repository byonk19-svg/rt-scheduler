import { describe, expect, it } from 'vitest'

import {
  OFFLINE_SHIFT_BOARD_CLOSURE_REASON,
  SCHEDULE_BLOCK_LIFECYCLE_MATRIX,
  canTakeScheduleBlockOffline,
} from '@/lib/schedule-lifecycle-matrix'

describe('schedule lifecycle matrix', () => {
  it('defines take-offline as a final-only transition with deterministic request closure', () => {
    expect(SCHEDULE_BLOCK_LIFECYCLE_MATRIX.take_offline).toMatchObject({
      from: ['final'],
      to: 'offline',
      requestPolicy:
        'Close pending Shift Board posts tied to the Schedule Block shifts and decline pending or selected responder interests.',
      mutationPolicy:
        'The Schedule Block is read-only outside lifecycle actions until republished.',
    })
    expect(SCHEDULE_BLOCK_LIFECYCLE_MATRIX.take_offline.reversal).toContain(
      'no other live block covers the same date range'
    )
    expect(SCHEDULE_BLOCK_LIFECYCLE_MATRIX.take_offline.notificationPolicy).toContain(
      'closure reason'
    )
  })

  it('keeps republish and archive separate from take-offline rules', () => {
    expect(SCHEDULE_BLOCK_LIFECYCLE_MATRIX.republish.from).toEqual(['offline'])
    expect(SCHEDULE_BLOCK_LIFECYCLE_MATRIX.republish.to).toBe('final')
    expect(SCHEDULE_BLOCK_LIFECYCLE_MATRIX.archive.from).toEqual([
      'draft',
      'preliminary',
      'offline',
    ])
    expect(SCHEDULE_BLOCK_LIFECYCLE_MATRIX.archive.to).toBe('archived')
  })

  it('allows take-offline only for live final Schedule Blocks', () => {
    expect(canTakeScheduleBlockOffline({ published: true, status: 'final' })).toBe(true)

    for (const status of ['draft', 'preliminary', 'offline', 'archived', null] as const) {
      expect(canTakeScheduleBlockOffline({ published: true, status }), String(status)).toBe(false)
    }
    expect(canTakeScheduleBlockOffline({ published: false, status: 'final' })).toBe(false)
  })

  it('uses one stable closure reason for offline request cleanup', () => {
    expect(OFFLINE_SHIFT_BOARD_CLOSURE_REASON).toBe(
      'Schedule block was taken offline. Submit a new request after it is republished.'
    )
  })
})
