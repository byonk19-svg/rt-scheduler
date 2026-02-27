import { describe, expect, it } from 'vitest'

import {
  aggregatePublishDeliveryCounts,
  buildPublishEmailPayload,
  refreshPublishEventCounts,
  type NotificationOutboxCountRow,
} from '@/lib/publish-events'

describe('aggregatePublishDeliveryCounts', () => {
  it('aggregates queued/sent/failed counts per publish event', () => {
    const rows: NotificationOutboxCountRow[] = [
      { publish_event_id: 'event-1', status: 'queued' },
      { publish_event_id: 'event-1', status: 'queued' },
      { publish_event_id: 'event-1', status: 'failed' },
      { publish_event_id: 'event-2', status: 'sent' },
    ]

    const counts = aggregatePublishDeliveryCounts(rows, ['event-1', 'event-2', 'event-3'])

    expect(counts.get('event-1')).toEqual({ queuedCount: 2, sentCount: 0, failedCount: 1 })
    expect(counts.get('event-2')).toEqual({ queuedCount: 0, sentCount: 1, failedCount: 0 })
    expect(counts.get('event-3')).toEqual({ queuedCount: 0, sentCount: 0, failedCount: 0 })
  })
})

describe('buildPublishEmailPayload', () => {
  it('builds subject/body including cycle label and schedule URL', () => {
    const payload = buildPublishEmailPayload({
      recipientName: 'Tannie',
      cycleLabel: 'Mar 22 - May 2',
      scheduleUrl: 'https://teamwise.test/staff/schedule',
    })

    expect(payload.subject).toContain('Mar 22 - May 2')
    expect(payload.text).toContain('https://teamwise.test/staff/schedule')
    expect(payload.html).toContain('View your schedule')
  })
})

describe('refreshPublishEventCounts', () => {
  it('updates publish_events with computed counts', async () => {
    const updates: Array<{ id: string; payload: Record<string, unknown> }> = []

    const admin = {
      from(table: string) {
        if (table === 'notification_outbox') {
          return {
            select() {
              return {
                in: async () => ({
                  data: [
                    { publish_event_id: 'event-1', status: 'queued' },
                    { publish_event_id: 'event-1', status: 'failed' },
                    { publish_event_id: 'event-2', status: 'sent' },
                  ],
                  error: null,
                }),
              }
            },
          }
        }

        if (table === 'publish_events') {
          return {
            update(payload: Record<string, unknown>) {
              return {
                eq: async (_column: string, id: string) => {
                  updates.push({ id, payload })
                  return { error: null }
                },
              }
            },
          }
        }

        throw new Error(`Unexpected table ${table}`)
      },
    } as unknown as Parameters<typeof refreshPublishEventCounts>[0]

    const counts = await refreshPublishEventCounts(admin, ['event-1', 'event-2'])

    expect(counts.get('event-1')).toEqual({ queuedCount: 1, sentCount: 0, failedCount: 1 })
    expect(counts.get('event-2')).toEqual({ queuedCount: 0, sentCount: 1, failedCount: 0 })
    expect(updates).toHaveLength(2)
    expect(updates.find((item) => item.id === 'event-1')?.payload).toMatchObject({
      queued_count: 1,
      sent_count: 0,
      failed_count: 1,
    })
  })
})
