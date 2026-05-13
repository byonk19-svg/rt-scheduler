import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

import CoverageRedirectPage, { metadata } from '@/app/(app)/coverage/page'

describe('coverage redirect route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects /coverage to the unified /schedule route', async () => {
    await expect(CoverageRedirectPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/schedule'
    )
  })

  it('preserves query params when redirecting to /schedule', async () => {
    await expect(
      CoverageRedirectPage({
        searchParams: Promise.resolve({
          cycle: 'cycle-1',
          shift: 'night',
          success: 'preliminary_sent',
        }),
      })
    ).rejects.toThrow('REDIRECT:/schedule?cycle=cycle-1&shift=night&success=preliminary_sent')
  })

  it('preserves repeated query params when redirecting to /schedule', async () => {
    await expect(
      CoverageRedirectPage({ searchParams: Promise.resolve({ panel: ['setup', 'new-cycle'] }) })
    ).rejects.toThrow('REDIRECT:/schedule?panel=setup&panel=new-cycle')
  })

  it('uses Schedule metadata', () => {
    expect(metadata.title).toBe('Schedule')
  })
})
