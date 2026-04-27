import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/therapist/settings/page.tsx'),
  'utf8'
)

describe('therapist settings route', () => {
  it('renders a therapist-owned preferences and work rules page', () => {
    expect(source).toContain('My Schedule Preferences')
    expect(source).toContain('Recurring Work Pattern')
    expect(source).toContain('This is your normal repeating schedule.')
    expect(source).toContain('Edit normal schedule')
    expect(source).toContain('Set normal schedule')
    expect(source).toContain(
      'Future Availability will start blank until you save a normal schedule.'
    )
    expect(source).toContain('/therapist/recurring-pattern')
    expect(source).toContain('Schedule Preferences')
    expect(source).toContain('Max consecutive days')
    expect(source).toContain('Notification preferences')
    expect(source).not.toContain("export { default } from '../../profile/page'")
  })
})
