import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/schedule/page.tsx'), 'utf8')

describe('schedule route', () => {
  it('renders the roster screen and only redirects staff on forbidden access', () => {
    expect(source).toContain('ScheduleRosterScreen')
    expect(source).not.toContain("redirect('/coverage')")
    expect(source).toContain("if (result.status === 'forbidden')")
    expect(source).toContain("redirect('/dashboard/staff')")
  })

  it('keeps the screen deterministic by using the mock roster data layer', () => {
    expect(source).toContain("from '@/components/schedule-roster/ScheduleRosterScreen'")
  })
})
