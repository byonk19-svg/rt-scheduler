import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadEligibleRequestTeammates, loadRequestPageSnapshot } from '@/lib/request-page-data'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-28T12:00:00.000Z'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function createSupabaseMock() {
  const shiftQuery = {
    eq(column: string) {
      if (column === 'user_id') {
        return {
          gte() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      order: async () => ({
                        data: [
                          {
                            id: 'shift-1',
                            date: '2026-05-01',
                            shift_type: 'day',
                            role: 'lead',
                            status: 'scheduled',
                            schedule_cycles: { published: true },
                          },
                        ],
                        error: null,
                      }),
                    }
                  },
                }
              },
            }
          },
        }
      }

      if (column === 'role') {
        return {
          in: async () => ({ data: [{ date: '2026-05-01', shift_type: 'day' }], error: null }),
        }
      }

      return shiftQuery
    },
    in: async () => ({
      data: [{ id: 'shift-1', date: '2026-05-01', shift_type: 'day', role: 'lead' }],
      error: null,
    }),
  }

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'therapist-1' } } }),
    },
    from(table: string) {
      if (table === 'shifts') {
        return { select: () => shiftQuery }
      }

      if (table === 'shift_posts') {
        const baseRows = [
          {
            id: 'post-1',
            type: 'pickup',
            status: 'pending',
            recipient_response: null,
            request_kind: 'standard',
            created_at: '2026-04-28T12:00:00.000Z',
            shift_id: 'shift-1',
            posted_by: 'therapist-1',
            claimed_by: null,
            visibility: 'team',
            message: 'Need coverage',
          },
        ]
        return {
          select() {
            return {
              or() {
                return {
                  order() {
                    return {
                      order: async () => ({ data: baseRows, error: null }),
                    }
                  },
                }
              },
              in: async () => ({ data: [], error: null }),
            }
          },
        }
      }

      if (table === 'shift_post_interests') {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      order: async () => ({ data: [], error: null }),
                    }
                  },
                }
              },
            }
          },
        }
      }

      if (table === 'profiles') {
        return {
          select() {
            return {
              in: async () => ({
                data: [{ id: 'therapist-2', full_name: 'Therapist Two' }],
                error: null,
              }),
            }
          },
        }
      }

      if (table === 'shift_operational_entries') {
        return {
          select() {
            return {
              eq() {
                return {
                  in: async () => ({ data: [], error: null }),
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

describe('request page data', () => {
  it('loads the therapist request snapshot with mapped shifts and requests', async () => {
    const snapshot = await loadRequestPageSnapshot(createSupabaseMock(), '2026-04-28')

    expect(snapshot).not.toBeNull()
    expect(snapshot?.myShifts).toHaveLength(1)
    expect(snapshot?.myOpenRequests.map((request) => request.message)).toEqual(['Need coverage'])
    expect(snapshot?.leadCountsBySlot).toEqual({ '2026-05-01:day': 1 })
  })

  it('filters eligible direct-request teammates by shift and lead requirement', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          teammates: [
            {
              id: 'therapist-2',
              name: 'Therapist Two',
              avatar: 'TT',
              shift: 'Day',
              isLead: true,
            },
          ],
        }),
      }))
    )

    const teammates = await loadEligibleRequestTeammates('shift-1')

    expect(teammates).toEqual([
      {
        id: 'therapist-2',
        name: 'Therapist Two',
        avatar: 'TT',
        shift: 'Day',
        isLead: true,
      },
    ])
  })
})
