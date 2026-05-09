import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deriveRequestStage,
  loadEligibleRequestTeammates,
  loadRequestPageSnapshot,
} from '@/lib/request-page-data'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-28T12:00:00.000Z'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function createSupabaseMock(overrides?: {
  requestRows?: Array<Record<string, unknown>>
  interestRows?: Array<Record<string, unknown>>
  profiles?: Array<{ id: string; full_name: string }>
}) {
  const requestRows = overrides?.requestRows ?? [
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
    {
      id: 'post-expired',
      type: 'pickup',
      status: 'pending',
      recipient_response: null,
      request_kind: 'standard',
      created_at: '2026-04-26T11:59:59.000Z',
      shift_id: 'shift-1',
      posted_by: 'therapist-1',
      claimed_by: null,
      visibility: 'team',
      message: 'Old coverage request',
    },
  ]
  const interestRows = overrides?.interestRows ?? [
    {
      id: 'interest-expired',
      shift_post_id: 'interest-post-expired',
      therapist_id: 'therapist-1',
      status: 'pending',
      created_at: '2026-04-28T11:00:00.000Z',
    },
  ]

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
          in() {
            return {
              eq() {
                return {
                  eq: async () => ({
                    data: [
                      {
                        id: 'lead-shift-1',
                        date: '2026-05-01',
                        shift_type: 'day',
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
        return {
          select() {
            return {
              or() {
                return {
                  order() {
                    return {
                      order: async () => ({ data: requestRows, error: null }),
                    }
                  },
                }
              },
              in: async () => ({
                data: [
                  {
                    id: 'interest-post-expired',
                    type: 'pickup',
                    status: 'pending',
                    recipient_response: null,
                    request_kind: 'standard',
                    created_at: '2026-04-26T11:59:59.000Z',
                    shift_id: 'shift-1',
                    posted_by: 'therapist-2',
                    claimed_by: null,
                    visibility: 'team',
                    message: 'Expired interest source',
                  },
                ],
                error: null,
              }),
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
                      order: async () => ({ data: interestRows, error: null }),
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
                data: overrides?.profiles ?? [{ id: 'therapist-2', full_name: 'Therapist Two' }],
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

  it('hides UI-expired pending requests and expired pickup interests from My Requests', async () => {
    const snapshot = await loadRequestPageSnapshot(createSupabaseMock(), '2026-04-28')

    expect(snapshot).not.toBeNull()
    expect(snapshot?.myOpenRequests.map((request) => request.id)).toEqual(['post-1'])
    expect(snapshot?.myOpenRequests.map((request) => request.status)).toEqual(['pending'])
  })

  it('filters eligible direct-request teammates by shift and lead requirement', async () => {
    const fetchMock = vi.fn(async () => ({
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
    vi.stubGlobal('fetch', fetchMock)

    const teammates = await loadEligibleRequestTeammates('shift-1', 'swap')

    expect(teammates).toEqual([
      {
        id: 'therapist-2',
        name: 'Therapist Two',
        avatar: 'TT',
        shift: 'Day',
        isLead: true,
      },
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/shift-posts/eligible-teammates?shiftId=shift-1&requestType=swap',
      { cache: 'no-store' }
    )
  })

  it('labels team swaps with a suggested partner as manager-review work', () => {
    const stage = deriveRequestStage({
      currentUserId: 'therapist-1',
      involvement: 'posted',
      request: {
        id: 'post-suggested',
        type: 'swap',
        status: 'pending',
        recipient_response: null,
        request_kind: 'standard',
        created_at: '2026-04-28T12:00:00.000Z',
        shift_id: 'shift-1',
        posted_by: 'therapist-1',
        claimed_by: 'therapist-2',
        visibility: 'team',
        message: 'Suggested team swap',
      },
    })

    expect(stage).toEqual({
      label: 'Waiting on manager approval',
      detail: 'You suggested a swap partner. A manager still has to approve the swap.',
    })
  })

  it('maps seeded received and suggested swap cards to the requester instead of the current therapist', async () => {
    const snapshot = await loadRequestPageSnapshot(
      createSupabaseMock({
        interestRows: [],
        profiles: [
          { id: 'therapist-1', full_name: 'Aleyce L.' },
          { id: 'therapist-2', full_name: 'Ruth G.' },
        ],
        requestRows: [
          {
            id: 'post-direct',
            type: 'swap',
            status: 'pending',
            recipient_response: 'pending',
            request_kind: 'standard',
            created_at: '2026-04-28T12:00:00.000Z',
            shift_id: 'shift-1',
            posted_by: 'therapist-2',
            claimed_by: 'therapist-1',
            visibility: 'direct',
            message: 'Seeded direct swap awaiting response',
          },
          {
            id: 'post-suggested',
            type: 'swap',
            status: 'pending',
            recipient_response: null,
            request_kind: 'standard',
            created_at: '2026-04-28T11:00:00.000Z',
            shift_id: 'shift-1',
            posted_by: 'therapist-2',
            claimed_by: 'therapist-1',
            visibility: 'team',
            message: 'Seeded team swap with suggested partner',
          },
        ],
      }),
      '2026-04-28'
    )

    expect(snapshot?.myOpenRequests).toEqual([
      expect.objectContaining({
        id: 'post-direct',
        involvement: 'received_direct',
        stageLabel: 'Needs your response',
        swapWith: 'Ruth G.',
      }),
      expect.objectContaining({
        id: 'post-suggested',
        involvement: 'claimed',
        stageLabel: 'Waiting on manager approval',
        swapWith: 'Ruth G.',
      }),
    ])
  })
})
