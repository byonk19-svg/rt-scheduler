import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { redirectMock, loadStaffOnboardingContextMock, completeStaffOnboardingActionMock } =
  vi.hoisted(() => ({
    redirectMock: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`)
    }),
    loadStaffOnboardingContextMock: vi.fn(),
    completeStaffOnboardingActionMock: vi.fn(),
  }))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/app/(app)/onboarding/actions', () => ({
  loadStaffOnboardingContext: loadStaffOnboardingContextMock,
  completeStaffOnboardingAction: completeStaffOnboardingActionMock,
}))

import OnboardingPage from '@/app/(app)/onboarding/page'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/onboarding/page.tsx'),
  'utf8'
)

describe('onboarding route copy', () => {
  it.each([
    ['incomplete', 'Finish setup is only available after the required steps are complete.'],
    ['complete_failed', 'We could not finish setup. Please try again.'],
  ])('renders %s onboarding feedback', async (error, message) => {
    loadStaffOnboardingContextMock.mockResolvedValue({
      status: {
        isRequired: true,
        hasRecordedCompletion: false,
        isComplete: false,
        shouldRecommendAvailability: false,
        steps: {
          schedule: {
            complete: false,
            href: '/therapist/recurring-pattern?return_to=%2Fonboarding',
          },
          preferences: {
            complete: false,
            href: '/therapist/settings?setup=preferences&return_to=%2Fonboarding',
          },
          notificationsAppearance: {
            complete: false,
            href: '/therapist/settings?setup=notifications&return_to=%2Fonboarding',
          },
        },
      },
    })

    const html = renderToStaticMarkup(
      await OnboardingPage({
        searchParams: Promise.resolve({ error }),
      })
    )

    expect(html).toContain(message)
  })

  it('locks the onboarding hub copy and required step labels', () => {
    expect(source).toContain('Setup your account')
    expect(source).toContain('Set your normal schedule')
    expect(source).toContain('Choose schedule preferences')
    expect(source).toContain('Choose notifications and appearance')
    expect(source).toContain('Review Future Availability')
  })
})
