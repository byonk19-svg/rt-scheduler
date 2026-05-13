import { describe, expect, it } from 'vitest'

import {
  canEditScheduleBlock,
  canPublishScheduleBlock,
  resolveScheduleBlockState,
} from '@/lib/schedule-block-state'

describe('schedule block state', () => {
  it('resolves lifecycle state from explicit precedence', () => {
    expect(resolveScheduleBlockState({ published: false })).toBe('created')
    expect(resolveScheduleBlockState({ published: false, shiftCount: 3 })).toBe('shifts_assigned')
    expect(
      resolveScheduleBlockState({
        published: false,
        shiftCount: 3,
        activePreliminarySnapshotId: 'snapshot-1',
      })
    ).toBe('preliminary_sent')
    expect(
      resolveScheduleBlockState({
        published: false,
        shiftCount: 3,
        activePreliminarySnapshotId: 'snapshot-1',
        hasPublishHistory: true,
      })
    ).toBe('offline')
    expect(resolveScheduleBlockState({ published: false, status: 'offline' })).toBe('offline')
    expect(resolveScheduleBlockState({ published: true, archivedAt: null })).toBe('published')
    expect(resolveScheduleBlockState({ published: true, archivedAt: '2026-05-09T12:00:00Z' })).toBe(
      'archived'
    )
  })

  it('makes edit and publish gates deterministic', () => {
    expect(canEditScheduleBlock('created')).toBe(true)
    expect(canEditScheduleBlock('preliminary_sent')).toBe(true)
    expect(canEditScheduleBlock('published')).toBe(false)
    expect(canEditScheduleBlock('offline')).toBe(false)
    expect(canEditScheduleBlock('archived')).toBe(false)

    expect(canPublishScheduleBlock('created')).toBe(false)
    expect(canPublishScheduleBlock('shifts_assigned')).toBe(true)
    expect(canPublishScheduleBlock('preliminary_sent')).toBe(true)
    expect(canPublishScheduleBlock('offline')).toBe(true)
    expect(canPublishScheduleBlock('archived')).toBe(false)
  })
})
