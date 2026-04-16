import { describe, expect, it, vi } from 'vitest'

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

import TherapistSchedulePage from '@/app/(app)/therapist/schedule/page'

describe('therapist schedule route', () => {
  it('preserves an explicit roster view when redirecting to coverage', async () => {
    await expect(
      TherapistSchedulePage({
        searchParams: Promise.resolve({
          view: 'roster',
          cycle: 'cycle-7',
          shift: 'night',
        }),
      })
    ).rejects.toThrow('REDIRECT:/coverage?view=roster&cycle=cycle-7&shift=night')
  })

  it('defers default view selection to coverage when no explicit view is present', async () => {
    await expect(
      TherapistSchedulePage({
        searchParams: Promise.resolve({
          cycle: 'cycle-7',
          shift: 'night',
        }),
      })
    ).rejects.toThrow('REDIRECT:/coverage?cycle=cycle-7&shift=night')
  })
})
