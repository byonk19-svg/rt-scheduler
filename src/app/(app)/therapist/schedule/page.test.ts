import fs from 'node:fs'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

import TherapistScheduleRedirectPage from '@/app/(app)/therapist/schedule/page'

const therapistScheduleSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/therapist/schedule/page.tsx'),
  'utf8'
)

describe('therapist schedule route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to the unified schedule page instead of shared coverage', async () => {
    await expect(
      TherapistScheduleRedirectPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('REDIRECT:/schedule')
    expect(therapistScheduleSource).not.toContain(
      "redirect(query ? `/coverage?${query}` : '/coverage')"
    )
  })

  it('preserves safe Schedule query params on redirect', async () => {
    await expect(
      TherapistScheduleRedirectPage({
        searchParams: Promise.resolve({
          cycle: 'cycle-1',
          shift: 'night',
          panel: 'legacy',
        }),
      })
    ).rejects.toThrow('REDIRECT:/schedule?cycle=cycle-1&shift=night')
  })

  it('sets redirect metadata for the unified schedule surface', () => {
    expect(therapistScheduleSource).toContain("title: 'Schedule'")
    expect(therapistScheduleSource).toContain('unified Schedule grid')
  })
})
