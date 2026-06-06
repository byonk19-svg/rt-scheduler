import { describe, expect, it, vi } from 'vitest'

import { notifyUsers } from '@/lib/notifications'

function makeNotificationClient(preferences: Array<Record<string, unknown>>) {
  const insertMock = vi.fn(async () => ({ error: null }))

  return {
    insertMock,
    client: {
      from(table: string) {
        if (table === 'profiles') {
          return {
            select() {
              return {
                in: vi.fn(async () => ({ data: preferences, error: null })),
              }
            },
          }
        }

        if (table === 'notifications') {
          return {
            insert: insertMock,
          }
        }

        throw new Error(`Unexpected table ${table}`)
      },
    },
  }
}

describe('notifyUsers', () => {
  it('dedupes recipients and skips users with in-app notifications disabled', async () => {
    const { client, insertMock } = makeNotificationClient([
      { id: 'user-1', notification_in_app_enabled: true },
      { id: 'user-2', notification_in_app_enabled: false },
    ])

    await notifyUsers(client as never, {
      userIds: ['user-1', 'user-1', '', 'user-2', 'user-3'],
      eventType: 'shift_post_claimed',
      title: 'Request updated',
      message: 'A request changed.',
      targetType: 'shift_post',
      targetId: 'post-1',
    })

    expect(insertMock).toHaveBeenCalledWith([
      {
        user_id: 'user-1',
        event_type: 'shift_post_claimed',
        title: 'Request updated',
        message: 'A request changed.',
        target_type: 'shift_post',
        target_id: 'post-1',
      },
      {
        user_id: 'user-3',
        event_type: 'shift_post_claimed',
        title: 'Request updated',
        message: 'A request changed.',
        target_type: 'shift_post',
        target_id: 'post-1',
      },
    ])
  })

  it('does not insert notification rows when all recipients are disabled', async () => {
    const { client, insertMock } = makeNotificationClient([
      { id: 'user-1', notification_in_app_enabled: false },
    ])

    await notifyUsers(client as never, {
      userIds: ['user-1'],
      eventType: 'shift_post_claimed',
      title: 'Request updated',
      message: 'A request changed.',
    })

    expect(insertMock).not.toHaveBeenCalled()
  })
})
