import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const profilePageSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/profile/page.tsx'),
  'utf8'
)
const profilePreferencesCardSource = readFileSync(
  resolve(process.cwd(), 'src/components/profile/ProfilePreferencesCard.tsx'),
  'utf8'
)
const preferredWorkDaysCardSource = readFileSync(
  resolve(process.cwd(), 'src/components/profile/PreferredWorkDaysCard.tsx'),
  'utf8'
)
const profileSummaryCardSource = readFileSync(
  resolve(process.cwd(), 'src/components/profile/ProfileSummaryCard.tsx'),
  'utf8'
)

describe('ProfilePage framing', () => {
  it('keeps the preferences form in a dedicated component', () => {
    expect(profilePreferencesCardSource).toContain('Default landing page')
    expect(profilePreferencesCardSource).toContain('Save preferences')
    expect(profilePageSource).toContain('ProfilePreferencesCard')
  })

  it('keeps the profile summary in a dedicated component', () => {
    expect(profileSummaryCardSource).toContain(
      'Account and staffing metadata used across scheduling tools.'
    )
    expect(profileSummaryCardSource).toContain('Email')
    expect(profilePageSource).toContain('ProfileSummaryCard')
  })

  it('keeps preferred work days in a dedicated component', () => {
    expect(preferredWorkDaysCardSource).toContain('Preferred Work Days')
    expect(preferredWorkDaysCardSource).toContain('Save preferred days')
    expect(profilePageSource).toContain('PreferredWorkDaysCard')
  })
})
