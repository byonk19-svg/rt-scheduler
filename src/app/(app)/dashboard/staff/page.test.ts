import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const staffDashboardSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/dashboard/staff/page.tsx'),
  'utf8'
)

describe('staff dashboard future availability links', () => {
  it('sends staff users to the dedicated therapist availability route through the attention card seam', () => {
    expect(staffDashboardSource).toContain('StaffAttentionCard')
    expect(staffDashboardSource).toContain('resolveAvailabilityDueStatus')
    expect(staffDashboardSource).toContain('resolveAvailabilityDueSupportLine')
    expect(staffDashboardSource).toContain("'therapist_availability_submissions'")
  })

  it('routes published-schedule actions through the unified schedule and swaps through therapist pages', () => {
    expect(staffDashboardSource).toContain('/schedule')
    expect(staffDashboardSource).toContain('/therapist/swaps')
    expect(staffDashboardSource).not.toContain('href="/shift-board"')
    expect(staffDashboardSource).not.toContain('href="/staff/my-schedule"')
  })

  it('avoids rendering a duplicate schedule CTA when the workflow already points to schedule', () => {
    expect(staffDashboardSource).toContain('workflowAlreadyLinksToSchedule')
    expect(staffDashboardSource).toContain("href?.startsWith('/schedule')")
  })
})

describe('staff dashboard therapist action-center copy', () => {
  it('keeps the staff page wired to the extracted next-step surface and therapist-owned destinations', () => {
    expect(staffDashboardSource).toContain('Next step')
    expect(staffDashboardSource).toContain('StaffAttentionCard')
    expect(staffDashboardSource).toContain('My Schedule')
    expect(staffDashboardSource).toContain('Shift Swaps &amp; Pickups')
    expect(staffDashboardSource).toContain('Past requests and outcomes')
    expect(staffDashboardSource).toContain('resolveTherapistWorkflow')
  })

  it('uses a plain no-published-shifts empty state with a next step', () => {
    expect(staffDashboardSource).toContain('No published shifts yet.')
    expect(staffDashboardSource).toContain('Check Schedule after the')
    expect(staffDashboardSource).toContain('next Schedule Block is published')
  })
})
