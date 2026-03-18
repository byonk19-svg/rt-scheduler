import { describe, expect, it, vi } from 'vitest'

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

import DirectoryPage from '@/app/directory/page'

describe('directory redirect behavior', () => {
  it('redirects to team', async () => {
    await expect(DirectoryPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/team'
    )
  })
})
