import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const staffDashboardSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/dashboard/staff/page.tsx'),
  'utf8'
)

describe('staff dashboard future availability links', () => {
  it('sends staff users to the dedicated therapist availability route', () => {
    expect(staffDashboardSource).toContain('href={workflow.primaryAction.href}')
    expect(staffDashboardSource).toContain('resolveAvailabilityDueSupportLine')
    expect(staffDashboardSource).toContain("'therapist_availability_submissions'")
  })

  it('routes published-schedule and swap actions through therapist-owned pages', () => {
    expect(staffDashboardSource).toContain('/therapist/schedule')
    expect(staffDashboardSource).toContain('/therapist/swaps')
    expect(staffDashboardSource).not.toContain('href="/shift-board"')
    expect(staffDashboardSource).not.toContain('href="/staff/my-schedule"')
  })
})

describe('staff dashboard therapist action-center copy', () => {
  it('uses the therapist workflow wording from the accuracy pass', () => {
    expect(staffDashboardSource).toContain('What needs your attention now')
    expect(staffDashboardSource).toContain('My Schedule')
    expect(staffDashboardSource).toContain('Shift Swaps &amp; Pickups')
    expect(staffDashboardSource).toContain('Past requests and outcomes')
    expect(staffDashboardSource).toContain('resolveTherapistWorkflow')
  })
})
