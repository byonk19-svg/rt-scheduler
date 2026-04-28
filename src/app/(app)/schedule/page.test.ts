import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/schedule/page.tsx'), 'utf8')

describe('schedule route', () => {
  it('renders the roster screen and only redirects staff on forbidden access', () => {
    expect(source).toContain('ScheduleRosterScreen')
    expect(source).toContain('if (!user)')
    expect(source).toContain("redirect('/login')")
    expect(source).toContain("if (role !== 'manager' && role !== 'lead')")
    expect(source).toContain("redirect('/dashboard/staff')")
  })

  it('keeps phase one deterministic by rendering the mock-only schedule screen directly', () => {
    expect(source).toContain("from '@/components/schedule-roster/ScheduleRosterScreen'")
    expect(source).not.toContain('loadScheduleRosterPageData')
  })
})
