import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('paper schedule demo seed', () => {
  it('marks seeded therapist login profiles as ready for staff app surfaces', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts/seed-demo-schedule.mjs'), 'utf8')

    expect(source).toContain("preferred_work_days_mode: 'no_preference'")
    expect(source).toContain(
      'staff_onboarding_preferences_confirmed_at: DEMO_ONBOARDING_COMPLETED_AT'
    )
    expect(source).toContain('staff_onboarding_theme_confirmed_at: DEMO_ONBOARDING_COMPLETED_AT')
    expect(source).toContain('staff_onboarding_completed_at: DEMO_ONBOARDING_COMPLETED_AT')
  })

  it('sets required availability override intents for paper schedule cells', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts/seed-demo-schedule.mjs'), 'utf8')

    expect(source).toContain("override_type: 'force_on'")
    expect(source).toContain("intent: 'therapist_wants_work'")
    expect(source).toContain("override_type: 'force_off'")
    expect(source).toContain("intent: 'therapist_need_off'")
  })
})
