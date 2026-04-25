import { describe, expect, it, vi } from 'vitest'

import { queueAndSendShiftReminders } from '@/lib/shift-reminders'

describe('queueAndSendShiftReminders', () => {
  it('queues tomorrow scheduled shifts, sends emails, and inserts notifications', async () => {
    const outboxUpdates: Array<{ id: string; payload: Record<string, unknown> }> = []
    const notificationsInserted: Array<Record<string, unknown>> = []
    const insertedOutboxRows: Array<Record<string, unknown>> = []

    const admin = {
      from(table: string) {
        if (table === 'shifts') {
          let selected = ''
          const builder = {
            select(selection: string) {
              selected = selection
              return builder
            },
            eq() {
              return builder
            },
            in() {
              return builder
            },
            then(resolve: (value: unknown) => unknown) {
              if (selected.includes('profiles!shifts_user_id_fkey')) {
                return Promise.resolve(
                  resolve({
                    data: [
                      {
                        id: 'shift-1',
                        date: '2026-04-18',
                        shift_type: 'day',
                        user_id: 'ther-1',
                        profiles: { email: 'therapist@example.com', full_name: 'Barbara C.' },
                      },
                    ],
                    error: null,
                  })
                )
              }

              return Promise.resolve(
                resolve({
                  data: [{ user_id: 'ther-1', date: '2026-04-18' }],
                  error: null,
                })
              )
            },
          }
          return builder
        }

        if (table === 'shift_reminder_outbox') {
          const builder = {
            upsert(rows: Record<string, unknown>[]) {
              insertedOutboxRows.push(...rows)
              return {
                select() {
                  return Promise.resolve({
                    data: rows.map((row, index) => ({ id: `outbox-${index + 1}`, ...row })),
                    error: null,
                  })
                },
              }
            },
            select() {
              return builder
            },
            lte() {
              return builder
            },
            eq() {
              return builder
            },
            order() {
              return builder
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
                      shift_id: 'shift-1',
                      user_id: 'ther-1',
                      email: 'therapist@example.com',
                      name: 'Barbara C.',
                      remind_type: '24h',
                      attempt_count: 0,
                      shifts: { date: '2026-04-18', shift_type: 'day' },
                    },
                  ],
                  error: null,
                })
              )
            },
          }
          return builder
        }

        if (table === 'notifications') {
          return {
            insert(payload: Record<string, unknown>) {
              notificationsInserted.push(payload)
              return Promise.resolve({ error: null })
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

    const result = await queueAndSendShiftReminders(admin, new Date('2026-04-17T06:00:00.000Z'))

    expect(result).toEqual({ queued: 1, sent: 1, failed: 0 })
    expect(insertedOutboxRows[0]).toMatchObject({
      shift_id: 'shift-1',
      user_id: 'ther-1',
      remind_type: '24h',
      email: 'therapist@example.com',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    const fetchPayload = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
    expect(fetchPayload.html).toContain('https://www.teamwise.work/therapist/schedule')
    expect(outboxUpdates[0]).toMatchObject({
      id: 'outbox-1',
      payload: expect.objectContaining({ status: 'sent', attempt_count: 1 }),
    })
    expect(notificationsInserted[0]).toMatchObject({
      user_id: 'ther-1',
      title: 'Shift reminder',
      event_type: 'shift_reminder',
      target_type: 'shift',
      target_id: 'shift-1',
    })

    vi.unstubAllGlobals()
  })
})
