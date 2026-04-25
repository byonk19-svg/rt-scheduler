import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/notifications', () => ({
  notifyUsers: vi.fn(async () => undefined),
}))

import { notifyUsers } from '@/lib/notifications'
import {
  notifyPreliminaryShiftAdded,
  notifyPreliminaryShiftMoved,
  notifyPreliminaryShiftRemoved,
} from '@/lib/preliminary-schedule-notifications'

describe('preliminary schedule notifications', () => {
  it('notifies when a therapist is added during a live preliminary cycle', async () => {
    await notifyPreliminaryShiftAdded({} as never, {
      preliminaryActive: true,
      userId: 'therapist-1',
      date: '2026-04-28',
      shiftType: 'day',
      targetId: 'shift-1',
    })

    expect(notifyUsers).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userIds: ['therapist-1'],
        eventType: 'preliminary_schedule_changed',
        targetType: 'shift',
        targetId: 'shift-1',
      })
    )
  })

  it('does not notify when there is no active preliminary schedule', async () => {
    await notifyPreliminaryShiftRemoved({} as never, {
      preliminaryActive: false,
      userId: 'therapist-1',
      date: '2026-04-28',
      shiftType: 'night',
      targetId: 'shift-2',
    })

    expect(notifyUsers).toHaveBeenCalledTimes(1)
  })

  it('formats move notifications with both dates', async () => {
    await notifyPreliminaryShiftMoved({} as never, {
      preliminaryActive: true,
      userId: 'therapist-2',
      fromDate: '2026-04-28',
      fromShiftType: 'day',
      toDate: '2026-04-29',
      toShiftType: 'night',
      targetId: 'shift-3',
    })

    expect(notifyUsers).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        message: expect.stringContaining('moved from Apr'),
      })
    )
  })
})
