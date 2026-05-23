import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { redirectMock, loadStaffOnboardingContextMock, completeScheduleSetupOnboardingActionMock } =
  vi.hoisted(() => ({
    redirectMock: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`)
    }),
    loadStaffOnboardingContextMock: vi.fn(),
    completeScheduleSetupOnboardingActionMock: vi.fn(),
  }))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/app/(app)/onboarding/actions', () => ({
  loadStaffOnboardingContext: loadStaffOnboardingContextMock,
  completeScheduleSetupOnboardingAction: completeScheduleSetupOnboardingActionMock,
}))

import OnboardingPage from '@/app/(app)/onboarding/page'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/onboarding/page.tsx'),
  'utf8'
)
const setupSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/onboarding/OnboardingScheduleSetup.tsx'),
  'utf8'
)
const actionSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/onboarding/actions.ts'),
  'utf8'
)

const previewPanelSource = setupSource
  .slice(
    setupSource.indexOf('function PreviewPanel('),
    setupSource.indexOf('function ConsecutiveDaysWarning(')
  )
  .trim()

describe('onboarding route copy', () => {
  function mockOnboardingContext() {
    loadStaffOnboardingContextMock.mockResolvedValue({
      profile: {
        id: 'therapist-1',
        max_consecutive_days: 3,
        preferred_work_days: [],
        preferred_work_days_mode: 'unset',
        work_patterns: null,
      },
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
  }

  it.each([
    ['incomplete', 'Finish setup after choosing a valid schedule and preferences.'],
    ['complete_failed', 'We could not finish setup. Please try again.'],
  ])('renders %s onboarding feedback', async (error, message) => {
    mockOnboardingContext()

    const html = renderToStaticMarkup(
      await OnboardingPage({
        searchParams: Promise.resolve({ error }),
      })
    )

    expect(html).toContain(message)
  })

  it('locks the onboarding hub copy and required step labels', () => {
    expect(setupSource).toContain('STEP_LABELS')
    expect(setupSource).toContain('Same days weekly')
    expect(setupSource).toContain('Custom repeating pattern')
    expect(setupSource).toContain('What kind of schedule do you usually follow?')
    expect(setupSource).toContain(
      'This helps Teamwise build a starting pattern. You can still adjust individual days later.'
    )
    expect(setupSource).toContain('Example: Mon, Wed, Fri.')
    expect(setupSource).toContain('Example: Every other weekend.')
    expect(setupSource).toContain('Example: 2 on / 2 off.')
    expect(setupSource).toContain('Best if your days vary a lot.')
    expect(setupSource).toContain('Choose your normal work days.')
    expect(setupSource).toContain('You can still mark exceptions later.')
    expect(setupSource).not.toContain("Next, you'll choose your normal work days.")
    expect(setupSource).not.toContain('Selected type')
    expect(setupSource).not.toContain('PICK YOUR WORK DAYS ON THE NEXT STEP.')
    expect(setupSource).not.toContain('Pick your work days on the next step.')
    expect(setupSource).not.toContain('Set the pattern next')
    expect(setupSource).not.toContain('This panel updates after you choose your work days.')
    expect(setupSource).toContain('Pick at least one day to continue.')
    expect(setupSource).toContain('First weekend you work')
    expect(setupSource).toContain('Days you never work')
    expect(setupSource).toContain('Days marked never work are disabled here.')
    expect(setupSource).toContain('Custom: tap days below')
    expect(setupSource).toContain('No fixed work days selected.')
    expect(setupSource).toContain('name="offs_dow"')
    expect(setupSource).toContain('weekendAnchorDate')
    expect(setupSource).toContain("initialPattern?.weekend_anchor_date ?? ''")
    expect(setupSource).not.toContain('getNextSaturdayKey')
    expect(setupSource).toContain('emptyWeeklyPreviewPattern')
    expect(setupSource).toContain("pattern_type: 'none'")
    expect(setupSource).not.toContain('setWeeklyDays([1, 2, 3, 4, 5])')
    expect(setupSource).toContain("step === 2 && scheduleType === 'repeating_cycle'")
    expect(setupSource).toContain('<RepeatingCycleStep')
    expect(setupSource).toContain('{cycleDays.length}-day cycle')
    expect(setupSource).toContain("join(' → ')")
    expect(setupSource).toContain('Build your pattern')
    expect(setupSource).toContain('Exit setup')
    expect(setupSource).toContain('Preview')
    expect(setupSource).toContain('Next 2 weeks')
    expect(setupSource).toContain('APP_PAGE_MAX_WIDTH_CLASS')
    expect(setupSource).toContain('app-shell-chrome-primary')
    expect(setupSource).toContain('shadow-tw-app-chrome')
    expect(setupSource).toContain('app-page-title')
    expect(setupSource).toContain('shadow-tw-md-strong')
    expect(setupSource).toContain('bg-[var(--success-subtle)]')
    expect(setupSource).toContain('Too many consecutive days')
    expect(setupSource).toContain('Turn off {daysToChange} work day')
    expect(setupSource).toContain('problemWeeklyDays')
    expect(setupSource).toContain('problemCycleDayIndexes')
    expect(setupSource).not.toContain('Fix it for me')
    expect(setupSource).not.toContain('fixConsecutiveDays')
    expect(setupSource).not.toContain('Pick how you usually work.')
    expect(setupSource).toContain('previewPulseKey')
    expect(setupSource).toContain('Preferred days (optional)')
    expect(setupSource).toContain('Your schedule is ready. You can adjust anything anytime.')
    expect(previewPanelSource).not.toContain('ConsecutiveDaysWarning')
    expect(setupSource).not.toContain('You can adjust anything later')
    expect(actionSource).toContain("formData.getAll('offs_dow')")
    expect(actionSource).toContain('offs_dow: neverWorkDays')
    expect(actionSource).toContain('safePreferredWorkDays')
    expect(source).toContain('View schedule')
    expect(source).toContain('completeScheduleSetupOnboardingAction')
  })

  it('renders the completed setup confirmation screen', async () => {
    mockOnboardingContext()

    const html = renderToStaticMarkup(
      await OnboardingPage({
        searchParams: Promise.resolve({ success: 'setup_complete' }),
      })
    )

    expect(html).toContain('You&#x27;re all set')
    expect(html).toContain('Your schedule is ready. You can adjust anything anytime.')
    expect(html).toContain('View schedule')
    expect(html).not.toContain('Open settings')
  })
})
