import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadShiftBoardSnapshot } from '@/lib/shift-board-snapshot'

type ShiftPostFixture = {
  id: string
  shift_id: string | null
  posted_by: string | null
  claimed_by: string | null
  visibility: 'team' | 'direct' | null
  recipient_response: 'pending' | 'accepted' | 'declined' | null
  request_kind?: 'standard' | 'call_in' | null
  message: string
  type: 'swap' | 'pickup'
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'withdrawn'
  created_at: string
  override_reason: string | null
}

function makeSupabaseMock({
  posts,
  pendingPosts = posts.filter((post) => post.status === 'pending'),
}: {
  posts: ShiftPostFixture[]
  pendingPosts?: ShiftPostFixture[]
}) {
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
          select(columns?: string) {
            if (columns?.includes('message')) {
              builder.__mode = 'posts'
            } else {
              builder.__mode = 'pending'
            }
            return builder
          },
          __mode: 'posts' as 'posts' | 'pending',
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
            return Promise.resolve({
              data: builder.__mode === 'pending' ? pendingPosts : posts,
              error: null,
            })
          },
          then(resolve: (value: unknown) => unknown) {
            return Promise.resolve(
              resolve({
                data: builder.__mode === 'pending' ? pendingPosts : posts,
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
            const builder = {
              in() {
                return builder
              },
              order() {
                return builder
              },
              then(resolve: (value: unknown) => unknown) {
                return Promise.resolve(
                  resolve({
                    data: [],
                    error: null,
                  })
                )
              },
            }

            return builder
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
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hides direct requests from unrelated therapists on the shared board', async () => {
    const snapshot = await loadShiftBoardSnapshot({
      supabase: makeSupabaseMock({
        posts: [
          {
            id: 'team-2',
            shift_id: null,
            posted_by: 'other-2',
            claimed_by: null,
            visibility: 'team',
            recipient_response: null,
            message: 'Open pickup second',
            type: 'pickup',
            status: 'pending',
            created_at: '2026-04-27T12:00:00.000Z',
            override_reason: null,
          },
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
            created_at: '2026-04-27T11:00:00.000Z',
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
            created_at: '2026-04-27T10:00:00.000Z',
            override_reason: null,
          },
        ],
      }),
      tab: 'open',
    })

    expect(snapshot.unauthorized).toBe(false)
    if (snapshot.unauthorized) return
    expect(snapshot.requests.map((request) => request.id)).toEqual(['team-2', 'team-1'])
  })

  it('removes UI-expired pending requests from the open board and pending count', async () => {
    const snapshot = await loadShiftBoardSnapshot({
      supabase: makeSupabaseMock({
        posts: [
          {
            id: 'recent-pending',
            shift_id: null,
            posted_by: 'other-1',
            claimed_by: null,
            visibility: 'team',
            recipient_response: null,
            message: 'Still open',
            type: 'pickup',
            status: 'pending',
            created_at: '2026-04-27T18:00:00.000Z',
            override_reason: null,
          },
          {
            id: 'old-pending',
            shift_id: null,
            posted_by: 'other-2',
            claimed_by: null,
            visibility: 'team',
            recipient_response: null,
            message: 'Should expire',
            type: 'pickup',
            status: 'pending',
            created_at: '2026-04-26T11:59:59.000Z',
            override_reason: null,
          },
        ],
      }),
      tab: 'open',
    })

    expect(snapshot.unauthorized).toBe(false)
    if (snapshot.unauthorized) return
    expect(snapshot.requests.map((request) => request.id)).toEqual(['recent-pending'])
    expect(snapshot.pendingCount).toBe(1)
  })

  it('routes UI-expired pending requests into history as expired', async () => {
    const snapshot = await loadShiftBoardSnapshot({
      supabase: makeSupabaseMock({
        posts: [
          {
            id: 'recent-pending',
            shift_id: null,
            posted_by: 'other-1',
            claimed_by: null,
            visibility: 'team',
            recipient_response: null,
            message: 'Still open',
            type: 'pickup',
            status: 'pending',
            created_at: '2026-04-27T18:00:00.000Z',
            override_reason: null,
          },
          {
            id: 'old-pending',
            shift_id: null,
            posted_by: 'other-2',
            claimed_by: null,
            visibility: 'team',
            recipient_response: null,
            message: 'Should expire',
            type: 'pickup',
            status: 'pending',
            created_at: '2026-04-26T11:59:59.000Z',
            override_reason: null,
          },
        ],
      }),
      tab: 'history',
    })

    expect(snapshot.unauthorized).toBe(false)
    if (snapshot.unauthorized) return
    expect(snapshot.requests.map((request) => [request.id, request.status])).toEqual([
      ['old-pending', 'expired'],
    ])
  })
})
