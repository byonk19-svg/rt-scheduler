import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const staffDashboardSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/dashboard/staff/page.tsx'),
  'utf8'
)

describe('staff dashboard future availability links', () => {
  it('sends staff users to the dedicated therapist availability route', () => {
    expect(staffDashboardSource).toContain('/therapist/availability')
    expect(staffDashboardSource).not.toContain('href="/availability"')
  })

  it('uses the admin client to resolve coworker names for the published schedule preview', () => {
    expect(staffDashboardSource).toContain('createAdminClient')
    expect(staffDashboardSource).toContain(".in('id', rosterUserIds)")
  })
})

describe('staff dashboard availability stat card', () => {
  it('marks the availability card as pending when the source code has conditional warning treatment', () => {
    expect(staffDashboardSource).toContain('availabilitySubmitted')
    expect(staffDashboardSource).toContain('var(--warning-subtle)')
    expect(staffDashboardSource).toContain('var(--warning-border)')
  })
})

describe('staff dashboard therapist action-center copy', () => {
  it('uses human cycle labeling and availability-for-cycle language', () => {
    expect(staffDashboardSource).toContain('Cycle:')
    expect(staffDashboardSource).toContain('Availability for This Cycle')
    expect(staffDashboardSource).toContain('requests awaiting action')
    expect(staffDashboardSource).toContain('Browse open shifts')
    expect(staffDashboardSource).toContain("'therapist_availability_submissions'")
    expect(staffDashboardSource).toContain('Welcome,')
    expect(staffDashboardSource).toContain('formatHumanCycleRange')
  })
})
