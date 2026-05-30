import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createAdminClientMock, processQueuedPublishEmailsMock, isValidPublishWorkerRequestMock } =
  vi.hoisted(() => ({
    createAdminClientMock: vi.fn(),
    processQueuedPublishEmailsMock: vi.fn(),
    isValidPublishWorkerRequestMock: vi.fn(async () => false),
  }))

import { POST } from '@/app/api/publish/process/route'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/publish-events', () => ({
  processQueuedPublishEmails: processQueuedPublishEmailsMock,
}))

vi.mock('@/lib/security/worker-auth', () => ({
  isValidPublishWorkerRequest: isValidPublishWorkerRequestMock,
}))

type Scenario = {
  userId?: string | null
  role?: string
  isActive?: boolean | null
  archivedAt?: string | null
  siteId?: string | null
  profileError?: { message: string } | null
}

function makeSupabaseMock(scenario: Scenario = {}) {
  return {
    auth: {
      getUser: async () => ({
        data: {
          user: scenario.userId === null ? null : { id: scenario.userId ?? 'manager-1' },
        },
      }),
    },
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => {
          if (table === 'profiles') {
            return {
              data:
                scenario.userId === null
                  ? null
                  : {
                      role: scenario.role ?? 'manager',
                      is_active: scenario.isActive ?? true,
                      archived_at: scenario.archivedAt ?? null,
                      site_id: Object.prototype.hasOwnProperty.call(scenario, 'siteId')
                        ? scenario.siteId
                        : 'site-a',
                    },
              error: scenario.profileError ?? null,
            }
          }

          return { data: null, error: null }
        },
      }

      return builder
    },
  }
}

function makeAdminMock(options: { eventSiteId?: string | null; eventMissing?: boolean } = {}) {
  return {
    from: (table: string) => {
      if (table !== 'publish_events') {
        throw new Error(`Unexpected admin table ${table}`)
      }

      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({
          data: options.eventMissing
            ? null
            : {
                id: 'event-1',
                schedule_cycles: { site_id: options.eventSiteId ?? 'site-a' },
              },
          error: null,
        }),
      }

      return builder
    },
  }
}

describe('publish process route security', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    isValidPublishWorkerRequestMock.mockResolvedValue(false)
  })

  it('rejects cross-origin browser requests before auth work', async () => {
    const response = await POST(
      new Request('http://localhost/api/publish/process', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://evil.example',
        },
        body: JSON.stringify({ batch_size: 25 }),
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid request origin.',
    })
    expect(createClient).not.toHaveBeenCalled()
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated browser requests before admin work', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({ userId: null }) as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/publish/process', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost',
        },
        body: JSON.stringify({ batch_size: 25 }),
      })
    )

    expect(response.status).toBe(401)
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(processQueuedPublishEmailsMock).not.toHaveBeenCalled()
  })

  it('rejects forbidden browser requests before admin work', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        role: 'therapist',
        userId: 'therapist-1',
      }) as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/publish/process', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost',
        },
        body: JSON.stringify({ batch_size: 25 }),
      })
    )

    expect(response.status).toBe(403)
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(processQueuedPublishEmailsMock).not.toHaveBeenCalled()
  })

  it('requires browser-triggered processing to name a publish event', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        role: 'manager',
        userId: 'manager-1',
      }) as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/publish/process', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost',
        },
        body: JSON.stringify({ batch_size: 25 }),
      })
    )

    expect(response.status).toBe(400)
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(processQueuedPublishEmailsMock).not.toHaveBeenCalled()
  })

  it('rejects browser-triggered processing for cross-site publish events', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        role: 'manager',
        userId: 'manager-1',
        siteId: 'site-a',
      }) as unknown as Awaited<ReturnType<typeof createClient>>
    )
    createAdminClientMock.mockReturnValue(makeAdminMock({ eventSiteId: 'site-b' }))

    const response = await POST(
      new Request('http://localhost/api/publish/process', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost',
        },
        body: JSON.stringify({ publish_event_id: 'event-1', batch_size: 25 }),
      })
    )

    expect(response.status).toBe(403)
    expect(processQueuedPublishEmailsMock).not.toHaveBeenCalled()
  })

  it('processes only the same-site publish event for browser managers', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        role: 'manager',
        userId: 'manager-1',
        siteId: 'site-a',
      }) as unknown as Awaited<ReturnType<typeof createClient>>
    )
    const admin = makeAdminMock({ eventSiteId: 'site-a' })
    createAdminClientMock.mockReturnValue(admin)
    processQueuedPublishEmailsMock.mockResolvedValue({
      ok: true,
      processed: 0,
      sent: 0,
      failed: 0,
      emailConfigured: true,
      publishEventCounts: null,
    })

    const response = await POST(
      new Request('http://localhost/api/publish/process', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost',
        },
        body: JSON.stringify({ publish_event_id: 'event-1', batch_size: 25 }),
      })
    )

    expect(response.status).toBe(200)
    expect(processQueuedPublishEmailsMock).toHaveBeenCalledWith(admin, {
      publishEventId: 'event-1',
      batchSize: 25,
    })
  })
})
