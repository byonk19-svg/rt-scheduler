import { beforeEach, describe, expect, it, vi } from 'vitest'

const { isValidPublishWorkerRequestMock, isTrustedMutationRequestMock, createAdminClientMock } =
  vi.hoisted(() => ({
    isValidPublishWorkerRequestMock: vi.fn(async () => false),
    isTrustedMutationRequestMock: vi.fn(() => true),
    createAdminClientMock: vi.fn(),
  }))

vi.mock('@/lib/security/worker-auth', () => ({
  isValidPublishWorkerRequest: isValidPublishWorkerRequestMock,
}))

vi.mock('@/lib/security/request-origin', () => ({
  isTrustedMutationRequest: isTrustedMutationRequestMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/can', () => ({
  can: vi.fn(() => true),
}))

vi.mock('@/lib/auth/roles', () => ({
  parseRole: vi.fn((r: string) => r),
}))

vi.mock('@/lib/publish-events', () => ({
  processQueuedPublishEmails: vi.fn(async () => ({
    ok: true,
    processed: 3,
    sent: 3,
    failed: 0,
    emailConfigured: true,
    publishEventCounts: null,
  })),
}))

import { POST } from '@/app/api/publish/process/route'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/can'
import { processQueuedPublishEmails } from '@/lib/publish-events'

function makeRequest(body: object = {}, origin = 'http://localhost') {
  return new Request('http://localhost/api/publish/process', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  })
}

function makeSupabaseMock(role: string | null) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: role !== null ? { id: 'user-1' } : null },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: role ? { role } : null,
            error: null,
          }),
        }),
      }),
    }),
  }
}

describe('publish/process route', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    isValidPublishWorkerRequestMock.mockResolvedValue(false)
    isTrustedMutationRequestMock.mockReturnValue(true)
  })

  describe('worker auth path', () => {
    it('processes queue directly when worker request is valid', async () => {
      isValidPublishWorkerRequestMock.mockResolvedValue(true)
      createAdminClientMock.mockReturnValue({})

      const response = await POST(makeRequest({ batch_size: 10 }))
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ ok: true, processed: 3 })
      // Should NOT have touched the user auth flow
      expect(createClient).not.toHaveBeenCalled()
    })

    it('passes batch_size and publish_event_id to processor', async () => {
      isValidPublishWorkerRequestMock.mockResolvedValue(true)
      createAdminClientMock.mockReturnValue({})

      await POST(makeRequest({ batch_size: 50, publish_event_id: 'event-99' }))
      expect(processQueuedPublishEmails).toHaveBeenCalledWith(expect.anything(), {
        publishEventId: 'event-99',
        batchSize: 50,
      })
    })

    it('clamps batch_size to 100 maximum', async () => {
      isValidPublishWorkerRequestMock.mockResolvedValue(true)
      createAdminClientMock.mockReturnValue({})

      await POST(makeRequest({ batch_size: 999 }))
      expect(processQueuedPublishEmails).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ batchSize: 100 })
      )
    })

    it('returns 500 when admin client initialization fails', async () => {
      isValidPublishWorkerRequestMock.mockResolvedValue(true)
      createAdminClientMock.mockImplementation(() => {
        throw new Error('Missing service role key')
      })

      const response = await POST(makeRequest())
      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({
        error: 'Could not initialize publish processing.',
      })
    })
  })

  describe('browser (manager) auth path', () => {
    it('returns 403 when request origin is untrusted and worker auth fails', async () => {
      isTrustedMutationRequestMock.mockReturnValue(false)
      const response = await POST(makeRequest({}, 'https://evil.example'))
      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toMatchObject({ error: 'Invalid request origin.' })
    })

    it('returns 401 when user is not authenticated', async () => {
      const supabase = makeSupabaseMock(null)
      vi.mocked(createClient).mockResolvedValue(
        supabase as unknown as Awaited<ReturnType<typeof createClient>>
      )

      const response = await POST(makeRequest())
      expect(response.status).toBe(401)
    })

    it('returns 403 when authenticated user is not a manager', async () => {
      const supabase = makeSupabaseMock('therapist')
      vi.mocked(createClient).mockResolvedValue(
        supabase as unknown as Awaited<ReturnType<typeof createClient>>
      )
      vi.mocked(can).mockReturnValue(false)

      const response = await POST(makeRequest())
      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toMatchObject({ error: 'Forbidden' })
    })

    it('processes queue when authenticated manager requests it', async () => {
      const supabase = makeSupabaseMock('manager')
      vi.mocked(createClient).mockResolvedValue(
        supabase as unknown as Awaited<ReturnType<typeof createClient>>
      )
      vi.mocked(can).mockReturnValue(true)
      createAdminClientMock.mockReturnValue({})

      const response = await POST(makeRequest({ batch_size: 5 }))
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ ok: true })
    })

    it('returns 500 when processQueuedPublishEmails throws', async () => {
      isValidPublishWorkerRequestMock.mockResolvedValue(true)
      createAdminClientMock.mockReturnValue({})
      vi.mocked(processQueuedPublishEmails).mockRejectedValue(new Error('DB unavailable'))

      const response = await POST(makeRequest())
      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({
        error: 'Could not process publish notifications.',
      })
    })
  })
})
