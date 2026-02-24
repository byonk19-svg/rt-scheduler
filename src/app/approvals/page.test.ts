import { describe, expect, it, vi } from 'vitest'

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

import ApprovalsPage from '@/app/approvals/page'

describe('approvals redirect behavior', () => {
  it('redirects to shift-board with published_only scope', async () => {
    await expect(
      ApprovalsPage({
        searchParams: Promise.resolve({ status: 'pending' }),
      })
    ).rejects.toThrow('REDIRECT:')

    const redirectedUrl = String(redirectMock.mock.calls[0]?.[0] ?? '')
    const [, queryAndHash = ''] = redirectedUrl.split('?')
    const [queryString = ''] = queryAndHash.split('#')
    const params = new URLSearchParams(queryString)

    expect(params.get('status')).toBe('pending')
    expect(params.get('published_only')).toBe('true')
  })

  it('applies default status pending when none is provided', async () => {
    redirectMock.mockClear()

    await expect(
      ApprovalsPage({
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('REDIRECT:')

    const redirectedUrl = String(redirectMock.mock.calls[0]?.[0] ?? '')
    const [, queryAndHash = ''] = redirectedUrl.split('?')
    const [queryString = ''] = queryAndHash.split('#')
    const params = new URLSearchParams(queryString)

    expect(params.get('status')).toBe('pending')
    expect(params.get('published_only')).toBe('true')
  })
})
