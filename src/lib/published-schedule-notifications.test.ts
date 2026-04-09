import { beforeEach, describe, expect, it, vi } from 'vitest'

const { notifyUsersMock } = vi.hoisted(() => ({
  notifyUsersMock: vi.fn(async () => undefined),
}))

vi.mock('@/lib/notifications', () => ({
  notifyUsers: notifyUsersMock,
}))

import {
  notifyPublishedShiftAdded,
  notifyPublishedShiftMoved,
  notifyPublishedShiftRemoved,
  notifyPublishedShiftStatusChanged,
} from '@/lib/published-schedule-notifications'

describe('published schedule change notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends an added notification only for published cycles', async () => {
    await notifyPublishedShiftAdded({} as never, {
      cyclePublished: false,
      userId: 'therapist-1',
      date: '2026-03-24',
      shiftType: 'day',
      targetId: 'shift-1',
    })

    expect(notifyUsersMock).not.toHaveBeenCalled()

    await notifyPublishedShiftAdded({} as never, {
      cyclePublished: true,
      userId: 'therapist-1',
      date: '2026-03-24',
      shiftType: 'day',
      targetId: 'shift-1',
    })

    expect(notifyUsersMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userIds: ['therapist-1'],
        eventType: 'published_schedule_changed',
        title: 'Published schedule updated',
        message: 'Your published schedule changed: you were added to a day shift on Mar 24.',
        targetType: 'shift',
        targetId: 'shift-1',
      })
    )
  })

  it('formats removed and moved messages for affected therapists', async () => {
    await notifyPublishedShiftRemoved({} as never, {
      cyclePublished: true,
      userId: 'therapist-1',
      date: '2026-03-24',
      shiftType: 'night',
      targetId: 'shift-2',
    })

    await notifyPublishedShiftMoved({} as never, {
      cyclePublished: true,
      userId: 'therapist-2',
      fromDate: '2026-03-24',
      fromShiftType: 'day',
      toDate: '2026-03-25',
      toShiftType: 'night',
      targetId: 'shift-3',
    })

    expect(notifyUsersMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        message: 'Your published schedule changed: your night shift on Mar 24 was removed.',
      })
    )
    expect(notifyUsersMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        message:
          'Your published schedule changed: your shift moved from Mar 24 day to Mar 25 night.',
      })
    )
  })

  it('formats published status-change notifications for operational updates', async () => {
    await notifyPublishedShiftStatusChanged({} as never, {
      cyclePublished: true,
      userId: 'therapist-3',
      date: '2026-03-26',
      shiftType: 'day',
      nextStatus: 'on_call',
      targetId: 'shift-4',
    })

    await notifyPublishedShiftStatusChanged({} as never, {
      cyclePublished: true,
      userId: 'therapist-4',
      date: '2026-03-27',
      shiftType: 'night',
      nextStatus: 'cancelled',
      targetId: 'shift-5',
    })

    expect(notifyUsersMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        message: 'Your published schedule changed: your day shift on Mar 26 is now on call.',
      })
    )
    expect(notifyUsersMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        message: 'Your published schedule changed: your night shift on Mar 27 was cancelled.',
      })
    )
  })
})
