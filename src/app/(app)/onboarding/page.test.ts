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
    expect(setupSource).toContain('Choose your weekdays and weekend rotation')
    expect(setupSource).toContain(
      'Select your normal weekdays, then choose the first weekend you work.'
    )
    expect(setupSource).toContain('Weekends are set by your rotation below.')
    expect(setupSource).toContain('You can still mark exceptions later.')
    expect(setupSource).not.toContain("Next, you'll choose your normal work days.")
    expect(setupSource).not.toContain('Selected type')
    expect(setupSource).not.toContain('PICK YOUR WORK DAYS ON THE NEXT STEP.')
    expect(setupSource).not.toContain('Pick your work days on the next step.')
    expect(setupSource).not.toContain('Set the pattern next')
    expect(setupSource).not.toContain('This panel updates after you choose your work days.')
    expect(setupSource).toContain('Pick at least one weekday.')
    expect(setupSource).toContain('First working weekend')
    expect(setupSource).toContain(
      'Choose the first weekend you work. Teamwise will repeat the every-other-weekend'
    )
    expect(setupSource).toContain('Choose the first working weekend.')
    expect(previewPanelSource).toContain('Weekend rotation not set yet.')
    expect(setupSource).toContain('getUpcomingWeekendOptions')
    expect(setupSource).toContain('formatWeekendAnchorRange')
    expect(setupSource).toContain('Starts rotation')
    expect(setupSource).not.toContain('Weekend option')
    expect(setupSource).toContain('No weekdays selected')
    expect(setupSource).toContain('aria-pressed={selected}')
    expect(previewPanelSource).toContain('First working weekend:')
    expect(setupSource).toContain('Advanced: days you are never available')
    expect(setupSource).toContain('Days marked never available are disabled here.')
    expect(setupSource).toContain('weeklyRows')
    expect(setupSource).toContain('Week {weekIndex + 1}')
    expect(setupSource).not.toContain('Blank')
    expect(setupSource).toContain('Updates as you choose days')
    expect(setupSource).toContain('Max allowed streak')
    expect(previewPanelSource).not.toContain('Read-only preview')
    expect(previewPanelSource).not.toContain('Your limit')
    expect(setupSource).toContain('Build your repeating work/off pattern')
    expect(setupSource).toContain(
      'Use this for rotations like 3 on / 3 off, 4 on / 4 off, or other repeating patterns.'
    )
    expect(setupSource).not.toContain('Baylor')
    expect(setupSource).toContain('Pattern starts on')
    expect(setupSource).toContain('Day 1 starts on this date.')
    expect(setupSource).toContain('Choose a preset')
    expect(setupSource).toContain('Pattern sequence')
    expect(setupSource).toContain('getCyclePreset')
    expect(setupSource).toContain("return ['work', 'work', 'work', 'off', 'off', 'off']")
    expect(setupSource).toContain('This pattern needs a {longestRun}-day max streak.')
    expect(setupSource).toContain('You can change the max streak in Preferences next')
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
    expect(setupSource).toContain('{cycleDays.length}-day pattern')
    expect(setupSource).toContain("join(' → ')")
    expect(setupSource).not.toContain('Build your pattern')
    expect(setupSource).not.toContain('This is your normal schedule.')
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
