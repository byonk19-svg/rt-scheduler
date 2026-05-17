import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/therapist/settings/page.tsx'),
  'utf8'
)
const preferredWorkDaysControlSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/PreferredWorkDaysFieldset.tsx'),
  'utf8'
)

describe('therapist settings route', () => {
  it('renders a therapist-owned preferences and work rules page', () => {
    expect(source).toContain('My Schedule Preferences')
    expect(source).toContain('Recurring Work Pattern')
    expect(source).toContain('This is your normal repeating schedule.')
    expect(source).toContain('Edit recurring pattern')
    expect(source).toContain('Set recurring pattern')
    expect(source).toContain(
      'Future Availability will start blank until you save a normal schedule.'
    )
    expect(source).toContain('make Schedule Block-only changes separately.')
    expect(source).toContain('/therapist/recurring-pattern')
    expect(source).toContain('Schedule Preferences')
    expect(source).toContain('Max consecutive days')
    expect(source).toContain('Notification preferences')
    expect(source).toContain('Day shift')
    expect(source).toContain('Night shift')
    expect(source).not.toContain('make cycle-only changes separately.')
    expect(source).not.toContain("export { default } from '../../profile/page'")
  })

  it('sets route-specific metadata', () => {
    expect(source).toContain("title: 'My Schedule Preferences'")
    expect(source).toContain('Manage recurring pattern, preferences, and notifications.')
  })

  it('offers an explicit no-preference option for preferred work days', () => {
    expect(source).toContain('PreferredWorkDaysFieldset')
    expect(source).toContain('legend="Preferred work days"')
    expect(preferredWorkDaysControlSource).toContain('name={modeInputName}')
    expect(preferredWorkDaysControlSource).toContain('value="no_preference"')
    expect(preferredWorkDaysControlSource).toContain('No preference')
    expect(preferredWorkDaysControlSource).toContain('disabled={!usesSpecificDays}')
  })
})
