import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/auth/signout/route'
import { createClient } from '@/lib/supabase/server'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
  })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('auth signout route', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects cross-origin signout requests', async () => {
    const response = await POST(
      new Request('http://localhost/auth/signout', {
        method: 'POST',
        headers: {
          origin: 'https://evil.example',
        },
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid request origin.',
    })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('signs out and redirects for trusted origins', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signOut,
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const response = await POST(
      new Request('http://localhost/auth/signout', {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
        },
      })
    )

    expect(signOut).toHaveBeenCalledOnce()
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost/')
  })
})
