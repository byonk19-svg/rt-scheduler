import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock, createAdminClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

import { GET } from '@/app/api/shift-posts/eligible-teammates/route'

function makeRequest(shiftId: string) {
  return new Request(`https://teamwise.test/api/shift-posts/eligible-teammates?shiftId=${shiftId}`)
}

describe('eligible request teammates API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads therapist teammates through the server route', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'therapist-1' } },
        })),
      },
    })

    const profileQuery = {
      eq: vi.fn(() => profileQuery),
      is: vi.fn(() => profileQuery),
      neq: vi.fn(() => profileQuery),
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve(
          resolve({
            data: [{ id: 'therapist-2', full_name: 'Therapist Two', is_lead_eligible: true }],
            error: null,
          })
        )
      },
    }

    createAdminClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'shifts') {
          return {
            select: vi.fn((columns: string, options?: { count?: 'exact'; head?: boolean }) => {
              if (options?.head) {
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        eq: vi.fn(() => ({
                          eq: vi.fn(async () => ({ count: 1, error: null })),
                        })),
                      })),
                    })),
                  })),
                }
              }

              return {
                eq: vi.fn(() => ({
                  maybeSingle: async () => ({
                    data: {
                      id: 'shift-1',
                      user_id: 'therapist-1',
                      date: '2026-05-01',
                      shift_type: 'day',
                      role: 'lead',
                      status: 'scheduled',
                      assignment_status: 'scheduled',
                      schedule_cycles: [{ published: true }],
                    },
                    error: null,
                  }),
                })),
              }
            }),
          }
        }

        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => profileQuery),
            })),
          }
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const response = await GET(makeRequest('shift-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.teammates).toEqual([
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
