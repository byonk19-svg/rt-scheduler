import { afterEach, describe, expect, it, vi } from 'vitest'

import { getSiteUrl, getSupabaseOrigin } from '@/lib/site-url'

describe('site-url', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('parses NEXT_PUBLIC_APP_URL when set', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://www.teamwise.work/')
    expect(getSiteUrl().origin).toBe('https://www.teamwise.work')
  })

  it('falls back to localhost when unset', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    expect(getSiteUrl().href).toBe('http://localhost:3000/')
  })

  it('falls back to localhost for invalid URL', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'not-a-url')
    expect(getSiteUrl().href).toBe('http://localhost:3000/')
  })

  it('returns supabase origin or null', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    expect(getSupabaseOrigin()).toBe('https://abc.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(getSupabaseOrigin()).toBeNull()
  })
})
