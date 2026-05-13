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

import StaffLegacyScheduleRoute from '@/app/(app)/staff/schedule/page'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/staff/schedule/page.tsx'),
  'utf8'
)

describe('staff legacy schedule route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to the unified schedule page', async () => {
    await expect(StaffLegacyScheduleRoute({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/schedule'
    )
    expect(source).not.toContain("redirect('/therapist/schedule')")
  })

  it('preserves safe Schedule query params on redirect', async () => {
    await expect(
      StaffLegacyScheduleRoute({
        searchParams: Promise.resolve({
          cycle: 'cycle-1',
          shift: 'night',
          view: 'old-roster',
        }),
      })
    ).rejects.toThrow('REDIRECT:/schedule?cycle=cycle-1&shift=night')
  })
})
