import fs from 'node:fs'
import path from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, createClientMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  createClientMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/app/(app)/requests/new/page', () => ({
  default: () => createElement('div', null, 'Therapist swap workspace'),
}))

import TherapistSwapsPage from '@/app/(app)/therapist/swaps/page'

describe('therapist swaps route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the therapist swap workspace for authenticated users', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: { user: { id: 'therapist-2' } },
        }),
      },
    })

    const html = renderToStaticMarkup(await TherapistSwapsPage())

    expect(html).toContain('Therapist swap workspace')
  })

  it('sets route-specific therapist swaps metadata', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/(app)/therapist/swaps/page.tsx'),
      'utf8'
    )

    expect(source).toContain("title: 'Trade & Coverage Requests'")
    expect(source).toContain('Create and track your trade and coverage requests.')
  })

  it('redirects to login when there is no authenticated user', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: { user: null },
        }),
      },
    })

    await expect(TherapistSwapsPage()).rejects.toThrow('REDIRECT:/login')
  })
})
