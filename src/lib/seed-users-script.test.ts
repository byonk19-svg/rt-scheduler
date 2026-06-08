import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('seed-users script', () => {
  it('keeps staff onboarding first-run by default but supports demo-ready staff profiles', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts/seed-users.mjs'), 'utf8')

    expect(source).toContain('SEED_USERS_ONBOARDING_COMPLETE')
    expect(source).toContain('const isOnboardingComplete = onboardingComplete && isStaffRole')
    expect(source).toContain(
      "preferred_work_days_mode: isOnboardingComplete ? 'no_preference' : 'unset'"
    )
    expect(source).toContain('staff_onboarding_preferences_confirmed_at: isOnboardingComplete')
    expect(source).toContain('staff_onboarding_completed_at: isOnboardingComplete')
  })
})
