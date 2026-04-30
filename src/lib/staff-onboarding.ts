import type { WorkPattern } from '@/lib/coverage/work-patterns'

export type PreferredWorkDaysMode = 'unset' | 'specific_days' | 'no_preference'

export type StaffOnboardingStepState = 'complete' | 'incomplete'

export type StaffOnboardingStepStatus = {
  complete: boolean
  state: StaffOnboardingStepState
  href: string
}

export type StaffOnboardingStatusInput = {
  role: string | null
  onboardingRequired: boolean
  preferredWorkDaysMode: PreferredWorkDaysMode
  preferencesConfirmedAt: string | null
  themeConfirmedAt: string | null
  completedAt: string | null
  workPattern: Pick<WorkPattern, 'pattern_type'> | null
  hasActionableAvailabilityCycle: boolean
}

export type StaffOnboardingStatus = {
  isRequired: boolean
  isComplete: boolean
  shouldRedirectToOnboarding: boolean
  shouldRecommendAvailability: boolean
  hasRecordedCompletion: boolean
  steps: {
    schedule: StaffOnboardingStepStatus
    preferences: StaffOnboardingStepStatus
    notificationsAppearance: StaffOnboardingStepStatus
  }
}

const SCHEDULE_STEP_HREF = '/therapist/recurring-pattern?return_to=/onboarding'
const PREFERENCES_STEP_HREF = '/therapist/settings?setup=preferences&return_to=/onboarding'
const NOTIFICATIONS_APPEARANCE_STEP_HREF =
  '/therapist/settings?setup=notifications&return_to=/onboarding'

function toStepStatus(complete: boolean, href: string): StaffOnboardingStepStatus {
  return {
    complete,
    state: complete ? 'complete' : 'incomplete',
    href,
  }
}

export function getStaffOnboardingStatus(input: StaffOnboardingStatusInput): StaffOnboardingStatus {
  const isManager = input.role === 'manager'
  const isRequired = !isManager && input.onboardingRequired
  const scheduleComplete = Boolean(input.workPattern)
  const preferencesComplete =
    input.preferredWorkDaysMode !== 'unset' && Boolean(input.preferencesConfirmedAt)
  const notificationsAppearanceComplete = Boolean(input.themeConfirmedAt)
  const hasRecordedCompletion = Boolean(input.completedAt)
  const isComplete =
    !isRequired || (scheduleComplete && preferencesComplete && notificationsAppearanceComplete)

  return {
    isRequired,
    isComplete,
    shouldRedirectToOnboarding: isRequired && !isComplete,
    shouldRecommendAvailability: isComplete && input.hasActionableAvailabilityCycle,
    hasRecordedCompletion,
    steps: {
      schedule: toStepStatus(scheduleComplete, SCHEDULE_STEP_HREF),
      preferences: toStepStatus(preferencesComplete, PREFERENCES_STEP_HREF),
      notificationsAppearance: toStepStatus(
        notificationsAppearanceComplete,
        NOTIFICATIONS_APPEARANCE_STEP_HREF
      ),
    },
  }
}
