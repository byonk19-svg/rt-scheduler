import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/app/schedule/page.tsx'), 'utf8')

describe('schedule route', () => {
  it('renders the mock roster screen instead of redirecting back to live coverage', () => {
    expect(source).toContain('ScheduleRosterScreen')
    expect(source).not.toContain('redirect(')
  })

  it('keeps the screen deterministic by using the mock roster data layer', () => {
    expect(source).toContain("from '@/components/schedule-roster/ScheduleRosterScreen'")
  })
})
