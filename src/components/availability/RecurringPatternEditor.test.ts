import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/availability/RecurringPatternEditor.tsx'),
  'utf8'
)

describe('RecurringPatternEditor', () => {
  it('uses simpler therapist-facing labels and a shorter preview rail', () => {
    expect(source).toContain("title: 'No repeating schedule'")
    expect(source).toContain("title: 'Rotating weekends'")
    expect(source).toContain('Which days do you usually work?')
    expect(source).toContain('Weekday flexibility')
    expect(source).toContain('My weekdays are flexible')
    expect(source).toContain('Select at least one fixed weekday, or mark weekdays as flexible.')
    expect(source).toContain('<CardTitle>What this saves</CardTitle>')
    expect(source).toContain('Each future Schedule Block starts blank')
    expect(source).toContain('This becomes the starting point for each future Schedule Block.')
    expect(source).toContain('Schedule Block edits stay separate as overrides.')
    expect(source).not.toContain('Each future cycle starts blank')
    expect(source).not.toContain('Each future cycle will start blank')
    expect(source).toContain('<CardTitle>Quick preview</CardTitle>')
    expect(source).toContain('Next 2 weeks')
    expect(source).toContain("'Off day'")
    expect(source).toContain("'Starts blank'")
    expect(source).toContain("toLocaleDateString('en-US', { month: 'short', day: 'numeric' })")
  })

  it('starts first-time therapists in a blank no-pattern state instead of a prefilled weekly template', () => {
    expect(source).toContain("initialPattern?.pattern_type ?? 'none'")
    expect(source).toContain('initialPattern?.weekly_weekdays ?? initialPattern?.works_dow ?? []')
    expect(source).toContain('isMissingRequiredWeeklyWeekdays(previewPattern)')
  })
})
