import { describe, expect, it } from 'vitest'

async function loadHelper() {
  return import('@/lib/staff-onboarding')
}

describe('getStaffOnboardingStatus', () => {
  it('skips onboarding for managers', async () => {
    const { getStaffOnboardingStatus } = await loadHelper()

    expect(
      getStaffOnboardingStatus({
        role: 'manager',
        onboardingRequired: false,
        preferredWorkDaysMode: 'unset',
        preferencesConfirmedAt: null,
        themeConfirmedAt: null,
        completedAt: null,
        workPattern: null,
        hasActionableAvailabilityCycle: false,
      }).isRequired
    ).toBe(false)
  })

  it('treats an explicit no-preference answer as complete for the preferences step', async () => {
    const { getStaffOnboardingStatus } = await loadHelper()

    expect(
      getStaffOnboardingStatus({
        role: 'therapist',
        onboardingRequired: true,
        preferredWorkDaysMode: 'no_preference',
        preferencesConfirmedAt: '2026-04-29T12:00:00Z',
        themeConfirmedAt: '2026-04-29T12:05:00Z',
        completedAt: null,
        workPattern: { pattern_type: 'none' },
        hasActionableAvailabilityCycle: true,
      }).steps.preferences.complete
    ).toBe(true)
  })

  it('requires onboarding for first-run staff even when a legacy profile did not set the flag', async () => {
    const { getStaffOnboardingStatus } = await loadHelper()
    const status = getStaffOnboardingStatus({
      role: 'therapist',
      onboardingRequired: false,
      preferredWorkDaysMode: 'unset',
      preferencesConfirmedAt: null,
      themeConfirmedAt: null,
      completedAt: null,
      workPattern: { pattern_type: 'weekly_fixed' },
      hasActionableAvailabilityCycle: false,
    })

    expect(status.isRequired).toBe(true)
    expect(status.hasRecordedCompletion).toBe(false)
  })

  it('keeps lead onboarding incomplete until schedule and preferences are explicit', async () => {
    const { getStaffOnboardingStatus } = await loadHelper()
    const status = getStaffOnboardingStatus({
      role: 'lead',
      onboardingRequired: true,
      preferredWorkDaysMode: 'unset',
      preferencesConfirmedAt: null,
      themeConfirmedAt: null,
      completedAt: null,
      workPattern: null,
      hasActionableAvailabilityCycle: false,
    })

    expect(status.steps.schedule.complete).toBe(false)
    expect(status.steps.preferences.complete).toBe(false)
    expect(status.steps.notificationsAppearance.complete).toBe(false)
    expect(status.isComplete).toBe(false)
  })

  it('does not require notification or appearance settings for onboarding completion', async () => {
    const { getStaffOnboardingStatus } = await loadHelper()
    const status = getStaffOnboardingStatus({
      role: 'therapist',
      onboardingRequired: true,
      preferredWorkDaysMode: 'no_preference',
      preferencesConfirmedAt: '2026-04-29T12:00:00Z',
      themeConfirmedAt: null,
      completedAt: null,
      workPattern: { pattern_type: 'weekly_fixed' },
      hasActionableAvailabilityCycle: false,
    })

    expect(status.steps.notificationsAppearance.complete).toBe(false)
    expect(status.isComplete).toBe(true)
  })
})
