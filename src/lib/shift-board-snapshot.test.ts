import { describe, expect, it } from 'vitest'

import { loadShiftBoardSnapshot } from '@/lib/shift-board-snapshot'

function makeSupabaseMock() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'therapist-1' } } }),
    },
    from(table: string) {
      if (table === 'profiles') {
        const builder = {
          select() {
            return builder
          },
          in() {
            return builder
          },
          eq() {
            return builder
          },
          order() {
            return Promise.resolve({ data: [], error: null })
          },
          maybeSingle: async () => ({
            data: {
              id: 'therapist-1',
              full_name: 'Barbara C.',
              role: 'therapist',
              employment_type: 'full_time',
            },
            error: null,
          }),
        }
        return builder
      }

      if (table === 'schedule_cycles') {
        return {
          select() {
            return {
              order() {
                return {
                  limit: async () => ({ data: [], error: null }),
                }
              },
            }
          },
        }
      }

      if (table === 'shift_posts') {
        const builder = {
          select() {
            return builder
          },
          order() {
            return builder
          },
          neq() {
            return builder
          },
          in() {
            return builder
          },
          limit() {
            return builder
          },
          eq() {
            return Promise.resolve({ count: 0, data: [], error: null })
          },
          then(resolve: (value: unknown) => unknown) {
            return Promise.resolve(
              resolve({
                data: [
                  {
                    id: 'team-1',
                    shift_id: null,
                    posted_by: 'other-1',
                    claimed_by: null,
                    visibility: 'team',
                    recipient_response: null,
                    message: 'Open pickup',
                    type: 'pickup',
                    status: 'pending',
                    created_at: '2026-04-24T12:00:00.000Z',
                    override_reason: null,
                  },
                  {
                    id: 'direct-1',
                    shift_id: null,
                    posted_by: 'other-1',
                    claimed_by: 'recipient-1',
                    visibility: 'direct',
                    recipient_response: 'pending',
                    message: 'Private request',
                    type: 'swap',
                    status: 'pending',
                    created_at: '2026-04-24T12:00:00.000Z',
                    override_reason: null,
                  },
                ],
                error: null,
              })
            )
          },
        }
        return builder
      }

      if (table === 'shift_post_interests') {
        return {
          select() {
            return {
              in: async () => ({
                data: [],
                error: null,
              }),
            }
          },
        }
      }

      if (table === 'shifts') {
        return {
          select() {
            return {
              eq() {
                return {
                  gte() {
                    return {
                      lte: async () => ({ data: [], error: null }),
                    }
                  },
                }
              },
              in: async () => ({ data: [], error: null }),
            }
          },
        }
      }

      if (table === 'shift_operational_entries') {
        return {
          select() {
            return {
              in() {
                return {
                  eq: async () => ({ data: [], error: null }),
                }
              },
            }
          },
        }
      }

      throw new Error(`Unexpected table ${table}`)
    },
  } as never
}

describe('loadShiftBoardSnapshot', () => {
  it('hides direct requests from unrelated therapists on the shared board', async () => {
    const snapshot = await loadShiftBoardSnapshot({
      supabase: makeSupabaseMock(),
      tab: 'open',
    })

    expect(snapshot.unauthorized).toBe(false)
    if (snapshot.unauthorized) return
    expect(snapshot.requests.map((request) => request.id)).toEqual(['team-1'])
  })
})
