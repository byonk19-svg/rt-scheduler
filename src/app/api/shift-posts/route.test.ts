import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock, createAdminClientMock, isTrustedMutationRequestMock, writeAuditLogMock } =
  vi.hoisted(() => ({
    createClientMock: vi.fn(),
    createAdminClientMock: vi.fn(),
    isTrustedMutationRequestMock: vi.fn(() => true),
    writeAuditLogMock: vi.fn(),
  }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/security/request-origin', () => ({
  isTrustedMutationRequest: isTrustedMutationRequestMock,
}))

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: writeAuditLogMock,
}))

import { POST } from '@/app/api/shift-posts/route'

type ServerContext = {
  userId?: string | null
  role?: string | null
  isActive?: boolean | null
  archivedAt?: string | null
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
                    is_active: context.isActive ?? true,
                    archived_at: context.archivedAt ?? null,
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

function makeAdminQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    gte: vi.fn(() => query),
    neq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    then: vi.fn((resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result))),
  }
  return query
}

function makeReviewAdminClient(params: {
  rpc?: ReturnType<typeof vi.fn>
  post?: unknown
  postError?: unknown
  interest?: unknown
  interestError?: unknown
}) {
  const rpc = params.rpc ?? vi.fn()
  return {
    rpc,
    from(table: string) {
      if (table === 'shift_posts') {
        return makeAdminQuery({
          data: params.post ?? {
            id: 'post-1',
            type: 'pickup',
            status: 'pending',
            visibility: 'team',
            recipient_response: null,
            claimed_by: null,
          },
          error: params.postError ?? null,
        })
      }
      if (table === 'shift_post_interests') {
        return makeAdminQuery({
          data: Object.prototype.hasOwnProperty.call(params, 'interest')
            ? params.interest
            : { id: 'interest-2', status: 'pending' },
          error: params.interestError ?? null,
        })
      }
      throw new Error(`Unexpected admin table ${table}`)
    },
  }
}

describe('shift-post mutation API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTrustedMutationRequestMock.mockReturnValue(true)
  })

  it('creates requests through the hardened database function', async () => {
    const rpcMock = vi.fn(async () => ({
      data: { id: 'post-1', swap_shift_id: 'partner-shift-1' },
      error: null,
    }))
    const shiftQueries = [
      makeAdminQuery({
        data: { cycle_id: 'cycle-1', date: '2026-05-04', shift_type: 'day' },
        error: null,
      }),
      makeAdminQuery({
        data: { id: 'partner-shift-1' },
        error: null,
      }),
    ]
    const fromMock = vi.fn((table: string) => {
      if (table === 'shift_operational_entries') {
        return makeAdminQuery({ data: [], error: null })
      }
      if (table !== 'shifts') {
        throw new Error(`Unexpected admin table ${table}`)
      }
      const query = shiftQueries.shift()
      if (!query) {
        throw new Error('Unexpected extra admin shifts query')
      }
      return query
    })

    createClientMock.mockResolvedValue(
      makeServerClient({ userId: 'therapist-1', role: 'therapist' })
    )
    createAdminClientMock.mockReturnValue({
      from: fromMock,
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

  it('creates pickup interests through the hardened database function', async () => {
    const rpcMock = vi.fn(async () => ({
      data: [{ id: 'interest-1', status: 'selected' }],
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
        action: 'express_interest',
        requestId: 'post-1',
      })
    )

    expect(response.status).toBe(200)
    expect(rpcMock).toHaveBeenCalledWith('app_express_shift_post_interest', {
      p_actor_id: 'therapist-1',
      p_post_id: 'post-1',
    })
  })

  it('blocks inactive actors before shift-post workflow mutations', async () => {
    const rpcMock = vi.fn(async () => ({
      data: null,
      error: { message: 'Pickup claimant is not eligible for this request.' },
    }))

    createClientMock.mockResolvedValue(
      makeServerClient({ userId: 'therapist-1', role: 'therapist', isActive: false })
    )
    createAdminClientMock.mockReturnValue({
      rpc: rpcMock,
    })

    const response = await POST(
      makeRequest({
        action: 'express_interest',
        requestId: 'post-1',
      })
    )

    expect(response.status).toBe(403)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('blocks archived actors before shift-post workflow mutations', async () => {
    const rpcMock = vi.fn()

    createClientMock.mockResolvedValue(
      makeServerClient({
        userId: 'therapist-1',
        role: 'therapist',
        archivedAt: '2026-05-01T12:00:00.000Z',
      })
    )
    createAdminClientMock.mockReturnValue({
      rpc: rpcMock,
    })

    const response = await POST(
      makeRequest({
        action: 'express_interest',
        requestId: 'post-1',
      })
    )

    expect(response.status).toBe(403)
    expect(rpcMock).not.toHaveBeenCalled()
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
        selectedInterestId: 'interest-2',
      })
    )

    expect(response.status).toBe(403)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('reviews pickup requests through the transactional review function', async () => {
    const rpcMock = vi.fn(async () => ({
      data: { id: 'post-1', status: 'approved', shift_id: 'shift-1', swap_shift_id: null },
      error: null,
    }))

    createClientMock.mockResolvedValue(makeServerClient({ userId: 'manager-1', role: 'manager' }))
    createAdminClientMock.mockReturnValue(makeReviewAdminClient({ rpc: rpcMock }))

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
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'manager-1',
        action: 'post_publish_modification',
        targetType: 'shift',
        targetId: 'shift-1',
      })
    )
  })

  it('records post-publish markers for both shifts when approving a swap request', async () => {
    const rpcMock = vi.fn(async () => ({
      data: {
        id: 'post-1',
        status: 'approved',
        shift_id: 'requester-shift-1',
        swap_shift_id: 'partner-shift-1',
      },
      error: null,
    }))

    createClientMock.mockResolvedValue(makeServerClient({ userId: 'manager-1', role: 'manager' }))
    createAdminClientMock.mockReturnValue(
      makeReviewAdminClient({
        rpc: rpcMock,
        post: {
          id: 'post-1',
          type: 'swap',
          status: 'pending',
          visibility: 'team',
          recipient_response: null,
          claimed_by: null,
        },
      })
    )

    const response = await POST(
      makeRequest({
        action: 'review_request',
        requestId: 'post-1',
        decision: 'approve',
        swapPartnerId: 'therapist-2',
      })
    )

    expect(response.status).toBe(200)
    expect(writeAuditLogMock).toHaveBeenCalledTimes(2)
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'manager-1',
        action: 'post_publish_modification',
        targetType: 'shift',
        targetId: 'requester-shift-1',
      })
    )
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'manager-1',
        action: 'post_publish_modification',
        targetType: 'shift',
        targetId: 'partner-shift-1',
      })
    )
  })

  it('returns lead-coverage review failures as client-visible validation errors', async () => {
    const rpcMock = vi.fn(async () => ({
      data: null,
      error: { message: 'Lead coverage gap: this shift would have no lead after approval.' },
    }))

    createClientMock.mockResolvedValue(makeServerClient({ userId: 'manager-1', role: 'manager' }))
    createAdminClientMock.mockReturnValue(makeReviewAdminClient({ rpc: rpcMock }))

    const response = await POST(
      makeRequest({
        action: 'review_request',
        requestId: 'post-1',
        decision: 'approve',
        selectedInterestId: 'interest-2',
      })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Lead coverage gap')
  })

  it('blocks denial for stale reviewed requests before the review RPC', async () => {
    const rpcMock = vi.fn()

    createClientMock.mockResolvedValue(makeServerClient({ userId: 'manager-1', role: 'manager' }))
    createAdminClientMock.mockReturnValue(
      makeReviewAdminClient({
        rpc: rpcMock,
        post: {
          id: 'post-1',
          type: 'pickup',
          status: 'approved',
          visibility: 'team',
          recipient_response: null,
          claimed_by: null,
        },
      })
    )

    const response = await POST(
      makeRequest({
        action: 'review_request',
        requestId: 'post-1',
        decision: 'deny',
      })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Only pending shift posts can be reviewed')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('blocks direct swaps waiting on teammate response before the review RPC', async () => {
    const rpcMock = vi.fn()

    createClientMock.mockResolvedValue(makeServerClient({ userId: 'manager-1', role: 'manager' }))
    createAdminClientMock.mockReturnValue(
      makeReviewAdminClient({
        rpc: rpcMock,
        post: {
          id: 'post-1',
          type: 'swap',
          status: 'pending',
          visibility: 'direct',
          recipient_response: 'pending',
          claimed_by: 'therapist-2',
        },
      })
    )

    const response = await POST(
      makeRequest({
        action: 'review_request',
        requestId: 'post-1',
        decision: 'approve',
      })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('accepted by the recipient')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('blocks open swaps without a partner before the review RPC', async () => {
    const rpcMock = vi.fn()

    createClientMock.mockResolvedValue(makeServerClient({ userId: 'manager-1', role: 'manager' }))
    createAdminClientMock.mockReturnValue(
      makeReviewAdminClient({
        rpc: rpcMock,
        post: {
          id: 'post-1',
          type: 'swap',
          status: 'pending',
          visibility: 'team',
          recipient_response: null,
          claimed_by: null,
        },
      })
    )

    const response = await POST(
      makeRequest({
        action: 'review_request',
        requestId: 'post-1',
        decision: 'approve',
      })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('require a swap partner')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('blocks pickup approval without an explicit selected responder before the review RPC', async () => {
    const rpcMock = vi.fn()

    createClientMock.mockResolvedValue(makeServerClient({ userId: 'manager-1', role: 'manager' }))
    createAdminClientMock.mockReturnValue(makeReviewAdminClient({ rpc: rpcMock }))

    const response = await POST(
      makeRequest({
        action: 'review_request',
        requestId: 'post-1',
        decision: 'approve',
      })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('selected responder')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('blocks stale selected responders before the review RPC', async () => {
    const rpcMock = vi.fn()

    createClientMock.mockResolvedValue(makeServerClient({ userId: 'manager-1', role: 'manager' }))
    createAdminClientMock.mockReturnValue(
      makeReviewAdminClient({
        rpc: rpcMock,
        interest: null,
      })
    )

    const response = await POST(
      makeRequest({
        action: 'review_request',
        requestId: 'post-1',
        decision: 'approve',
        selectedInterestId: 'interest-stale',
      })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('no longer available')
    expect(rpcMock).not.toHaveBeenCalled()
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
