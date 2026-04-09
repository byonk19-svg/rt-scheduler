import { describe, expect, it, vi } from 'vitest'

import {
  aggregatePublishDeliveryCounts,
  buildPublishEmailPayload,
  processQueuedPublishEmails,
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

describe('processQueuedPublishEmails', () => {
  it('sends queued emails immediately and refreshes publish counts', async () => {
    const outboxUpdates: Array<{ id: string; payload: Record<string, unknown> }> = []
    const eventUpdates: Array<{ id: string; payload: Record<string, unknown> }> = []

    const admin = {
      from(table: string) {
        if (table === 'notification_outbox') {
          let selected = ''
          const builder = {
            select(selection: string) {
              selected = selection
              return builder
            },
            eq(column: string, value: unknown) {
              void column
              void value
              return builder
            },
            order() {
              return builder
            },
            limit() {
              return builder
            },
            in(column: string, ids: string[]) {
              void column
              if (selected.includes('publish_event_id, status')) {
                return Promise.resolve({
                  data: ids.map((id) => ({
                    publish_event_id: id,
                    status: 'sent',
                  })),
                  error: null,
                })
              }
              return Promise.resolve({ data: null, error: null })
            },
            update(payload: Record<string, unknown>) {
              return {
                eq(_column: string, id: string) {
                  outboxUpdates.push({ id, payload })
                  return Promise.resolve({ error: null })
                },
              }
            },
            then(resolve: (value: unknown) => unknown) {
              return Promise.resolve(
                resolve({
                  data: [
                    {
                      id: 'outbox-1',
                      publish_event_id: 'event-1',
                      email: 'therapist@example.com',
                      name: 'Tannie',
                      attempt_count: 0,
                    },
                  ],
                  error: null,
                })
              )
            },
          }

          return builder
        }

        if (table === 'publish_events') {
          let selected = ''
          return {
            select(selection: string) {
              selected = selection
              return this
            },
            in(_column: string, ids: string[]) {
              if (selected.includes('schedule_cycles(label)')) {
                return Promise.resolve({
                  data: ids.map((id) => ({
                    id,
                    schedule_cycles: { label: 'Apr 2026' },
                  })),
                  error: null,
                })
              }
              return Promise.resolve({ data: null, error: null })
            },
            update(payload: Record<string, unknown>) {
              return {
                eq(_column: string, id: string) {
                  eventUpdates.push({ id, payload })
                  return Promise.resolve({ error: null })
                },
              }
            },
          }
        }

        throw new Error(`Unexpected table ${table}`)
      },
    } as never

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      text: async () => '',
    })
    vi.stubGlobal('fetch', fetchMock)

    process.env.RESEND_API_KEY = 'resend-key'
    process.env.PUBLISH_EMAIL_FROM = 'Teamwise <noreply@mail.teamwise.work>'
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.teamwise.work'

    const result = await processQueuedPublishEmails(admin, {
      publishEventId: 'event-1',
      batchSize: 10,
    })

    expect(result).toMatchObject({
      processed: 1,
      sent: 1,
      failed: 0,
      emailConfigured: true,
      publishEventCounts: { queuedCount: 0, sentCount: 1, failedCount: 0 },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(outboxUpdates[0]).toMatchObject({
      id: 'outbox-1',
      payload: expect.objectContaining({ status: 'sent', attempt_count: 1 }),
    })
    expect(eventUpdates.find((row) => row.id === 'event-1')?.payload).toMatchObject({
      queued_count: 0,
      sent_count: 1,
      failed_count: 0,
    })

    vi.unstubAllGlobals()
  })
})
