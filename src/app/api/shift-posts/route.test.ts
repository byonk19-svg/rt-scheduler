import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock, createAdminClientMock, isTrustedMutationRequestMock } = vi.hoisted(
  () => ({
    createClientMock: vi.fn(),
    createAdminClientMock: vi.fn(),
    isTrustedMutationRequestMock: vi.fn(() => true),
  })
)

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/security/request-origin', () => ({
  isTrustedMutationRequest: isTrustedMutationRequestMock,
}))

import { POST } from '@/app/api/shift-posts/route'

type ServerContext = {
  userId?: string | null
  role?: string | null
}

function makeServerClient(context: ServerContext) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: context.userId ? { id: context.userId } : null,
        },
      })),
    },
    from(table: string) {
      if (table !== 'profiles') {
        throw new Error(`Unexpected server table ${table}`)
      }

      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: {
                    role: context.role ?? null,
                    is_active: true,
                    archived_at: null,
                  },
                  error: null,
                }),
              }
            },
          }
        },
      }
    },
  } as never
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('https://teamwise.test/api/shift-posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://teamwise.test',
    },
    body: JSON.stringify(body),
  })
}

describe('shift-post mutation API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTrustedMutationRequestMock.mockReturnValue(true)
  })

  it('creates requests through the hardened database function', async () => {
    const rpcMock = vi.fn(async () => ({
      data: { id: 'post-1' },
      error: null,
    }))

    createClientMock.mockResolvedValue(
      makeServerClient({ userId: 'therapist-1', role: 'therapist' })
    )
    createAdminClientMock.mockReturnValue({
      rpc: rpcMock,
    })

    const response = await POST(
      makeRequest({
        action: 'create_request',
        shiftId: 'shift-1',
        requestType: 'swap',
        visibility: 'direct',
        teammateId: 'therapist-2',
        message: 'Please swap with me',
      })
    )

    expect(response.status).toBe(200)
    expect(rpcMock).toHaveBeenCalledWith('app_create_shift_post_request', {
      p_actor_id: 'therapist-1',
      p_shift_id: 'shift-1',
      p_type: 'swap',
      p_visibility: 'direct',
      p_claimed_by: 'therapist-2',
      p_message: 'Please swap with me',
    })
  })

  it('creates pickup interests through the trusted route instead of direct client writes', async () => {
    const shiftPostsSelect = {
      eq: vi.fn(() => ({
        maybeSingle: async () => ({
          data: {
            id: 'post-1',
            posted_by: 'other-user',
            status: 'pending',
            type: 'pickup',
            visibility: 'team',
          },
          error: null,
        }),
      })),
    }
    const selectedInterestLookup = {
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: async () => ({
            data: { id: 'selected-interest' },
            error: null,
          }),
        })),
      })),
    }
    const insertSingle = vi.fn(async () => ({
      data: { id: 'interest-1' },
      error: null,
    }))

    createClientMock.mockResolvedValue(
      makeServerClient({ userId: 'therapist-1', role: 'therapist' })
    )
    createAdminClientMock.mockReturnValue({
      rpc: vi.fn(),
      from: vi.fn((table: string) => {
        if (table === 'shift_posts') {
          return {
            select: vi.fn(() => shiftPostsSelect),
          }
        }

        if (table === 'shift_post_interests') {
          return {
            select: vi.fn(() => selectedInterestLookup),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: insertSingle,
              })),
            })),
          }
        }

        throw new Error(`Unexpected admin table ${table}`)
      }),
    })

    const response = await POST(
      makeRequest({
        action: 'express_interest',
        requestId: 'post-1',
      })
    )

    expect(response.status).toBe(200)
    expect(insertSingle).toHaveBeenCalled()
  })

  it('blocks review actions for non-managers before calling the review function', async () => {
    const rpcMock = vi.fn()

    createClientMock.mockResolvedValue(
      makeServerClient({ userId: 'therapist-1', role: 'therapist' })
    )
    createAdminClientMock.mockReturnValue({
      rpc: rpcMock,
    })

    const response = await POST(
      makeRequest({
        action: 'review_request',
        requestId: 'post-1',
        decision: 'approve',
      })
    )

    expect(response.status).toBe(403)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('reviews pickup requests through the transactional review function', async () => {
    const rpcMock = vi.fn(async () => ({
      data: { id: 'post-1', status: 'approved' },
      error: null,
    }))

    createClientMock.mockResolvedValue(makeServerClient({ userId: 'manager-1', role: 'manager' }))
    createAdminClientMock.mockReturnValue({
      rpc: rpcMock,
    })

    const response = await POST(
      makeRequest({
        action: 'review_request',
        requestId: 'post-1',
        decision: 'approve',
        selectedInterestId: 'interest-2',
        override: true,
        overrideReason: 'Coverage verified manually',
      })
    )

    expect(response.status).toBe(200)
    expect(rpcMock).toHaveBeenCalledWith('app_review_shift_post', {
      p_actor_id: 'manager-1',
      p_post_id: 'post-1',
      p_decision: 'approve',
      p_selected_interest_id: 'interest-2',
      p_swap_partner_id: null,
      p_manager_override: true,
      p_override_reason: 'Coverage verified manually',
    })
  })

  it('denies pickup claimants through the transactional claimant function', async () => {
    const rpcMock = vi.fn(async () => ({
      data: [{ denied_interest_id: 'interest-1', promoted_interest_id: 'interest-2' }],
      error: null,
    }))

    createClientMock.mockResolvedValue(makeServerClient({ userId: 'manager-1', role: 'manager' }))
    createAdminClientMock.mockReturnValue({
      rpc: rpcMock,
    })

    const response = await POST(
      makeRequest({
        action: 'deny_claimant',
        requestId: 'post-1',
        interestId: 'interest-1',
      })
    )

    expect(response.status).toBe(200)
    expect(rpcMock).toHaveBeenCalledWith('app_deny_pickup_claimant', {
      p_actor_id: 'manager-1',
      p_post_id: 'post-1',
      p_interest_id: 'interest-1',
    })
  })
})
