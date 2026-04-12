import { beforeEach, describe, expect, it, vi } from 'vitest'

const { hmacSha256HexMock } = vi.hoisted(() => ({
  hmacSha256HexMock: vi.fn(async () => 'fake-sig'),
}))

vi.mock('@/lib/security/worker-auth', () => ({
  hmacSha256Hex: hmacSha256HexMock,
}))

import { GET } from '@/app/api/cron/process-publish/route'

const BASE_ENV = {
  CRON_SECRET: 'test-cron-secret',
  PUBLISH_WORKER_KEY: 'test-worker-key',
  PUBLISH_WORKER_SIGNING_KEY: 'test-signing-key',
  NEXT_PUBLIC_APP_URL: 'https://www.teamwise.work',
}

function makeRequest(authHeader?: string) {
  return new Request('https://www.teamwise.work/api/cron/process-publish', {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

describe('cron/process-publish route', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.unstubAllEnvs()
    for (const [key, value] of Object.entries(BASE_ENV)) {
      vi.stubEnv(key, value)
    }
    hmacSha256HexMock.mockResolvedValue('fake-sig')
  })

  it('returns 500 when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const response = await GET(makeRequest('Bearer test-cron-secret'))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: 'Cron not configured.' })
  })

  it('returns 401 when authorization header is missing', async () => {
    const response = await GET(makeRequest())
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized.' })
  })

  it('returns 401 when authorization header has wrong secret', async () => {
    const response = await GET(makeRequest('Bearer wrong-secret'))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized.' })
  })

  it('returns 401 when authorization is not a Bearer token', async () => {
    const response = await GET(makeRequest('Basic test-cron-secret'))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized.' })
  })

  it('returns 500 when worker env vars are missing', async () => {
    vi.stubEnv('PUBLISH_WORKER_KEY', '')
    const response = await GET(makeRequest('Bearer test-cron-secret'))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: 'Worker not configured.' })
  })

  it('returns 500 when NEXT_PUBLIC_APP_URL is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    const response = await GET(makeRequest('Bearer test-cron-secret'))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: 'Worker not configured.' })
  })

  it('forwards worker auth headers and returns ok on success', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, processed: 5 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const response = await GET(makeRequest('Bearer test-cron-secret'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true, processed: 5 })

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(String(url)).toBe('https://www.teamwise.work/api/publish/process')
    expect((init?.headers as Record<string, string>)['x-publish-worker-key']).toBe(
      'test-worker-key'
    )
    expect((init?.headers as Record<string, string>)['x-publish-worker-signature']).toBe('fake-sig')
    fetchSpy.mockRestore()
  })

  it('returns 502 when downstream publish/process fails', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Something broke' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    )

    const response = await GET(makeRequest('Bearer test-cron-secret'))
    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({ error: 'Publish process failed.' })
    fetchSpy.mockRestore()
  })

  it('returns 500 when downstream fetch throws a network error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const response = await GET(makeRequest('Bearer test-cron-secret'))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Failed to trigger publish process.',
    })
    fetchSpy.mockRestore()
  })

  it('strips trailing slash from app URL when building process URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://www.teamwise.work/')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    await GET(makeRequest('Bearer test-cron-secret'))
    const [url] = fetchSpy.mock.calls[0]!
    expect(String(url)).toBe('https://www.teamwise.work/api/publish/process')
    fetchSpy.mockRestore()
  })
})
