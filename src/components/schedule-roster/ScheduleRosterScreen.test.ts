import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/schedule-roster/ScheduleRosterScreen.tsx'),
  'utf8'
)

describe('ScheduleRosterScreen', () => {
  it('uses Roster naming and keeps a persistent read-only badge', () => {
    expect(source).toContain('title="Roster"')
    expect(source).toContain('status="READ ONLY"')
    expect(source).not.toContain('title="Schedule"')
  })

  it('explains that the surface is read-only and routes editing back to Coverage', () => {
    expect(source).toContain('Read-only roster for the selected cycle')
    expect(source).toContain('Edit staffing in Coverage')
    expect(source).toContain('Open Coverage')
  })
})
