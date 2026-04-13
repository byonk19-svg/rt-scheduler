import { describe, expect, it, vi } from 'vitest'

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
  })),
}))

import SchedulePage from '@/app/schedule/page'

describe('schedule route', () => {
  it('preserves an explicit calendar view when redirecting to coverage', async () => {
    await expect(
      SchedulePage({
        searchParams: Promise.resolve({
          view: 'calendar',
          cycle: 'cycle-7',
          shift: 'night',
        }),
      })
    ).rejects.toThrow('REDIRECT:/coverage?view=calendar&cycle=cycle-7&shift=night')
  })

  it('defers default view selection to coverage when no explicit view is present', async () => {
    await expect(
      SchedulePage({
        searchParams: Promise.resolve({
          cycle: 'cycle-7',
          shift: 'night',
        }),
      })
    ).rejects.toThrow('REDIRECT:/coverage?cycle=cycle-7&shift=night')
  })
})
