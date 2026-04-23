import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/schedule-roster/ScheduleRosterScreen.tsx'),
  'utf8'
)

describe('ScheduleRosterScreen copy', () => {
  it('titles the page as a roster and keeps a persistent read-only indicator', () => {
    expect(source).toContain('title="Roster"')
    expect(source).toContain('status="READ ONLY"')
  })

  it('explains that the page is read-only and points editing back to Coverage', () => {
    expect(source).toContain(
      'Read-only roster for this 6-week block. Edit assignments in Coverage.'
    )
    expect(source).toContain('Open Coverage')
  })
})
