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

import StaffMyScheduleRedirectPage from '@/app/(app)/staff/my-schedule/page'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/staff/my-schedule/page.tsx'),
  'utf8'
)

describe('staff my-schedule legacy route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to the unified schedule page', async () => {
    await expect(
      StaffMyScheduleRedirectPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('REDIRECT:/schedule')
    expect(source).not.toContain('My Shifts')
  })

  it('preserves safe Schedule query params on redirect', async () => {
    await expect(
      StaffMyScheduleRedirectPage({
        searchParams: Promise.resolve({
          cycle: 'cycle-1',
          shift: 'night',
          start: '2026-05-03',
        }),
      })
    ).rejects.toThrow('REDIRECT:/schedule?cycle=cycle-1&shift=night')
  })
})
