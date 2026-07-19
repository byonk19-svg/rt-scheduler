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
    expect(staffDashboardSource).toContain('StaffScheduleBlockPanel')
    expect(staffDashboardSource).toContain('scheduleBlockView')
    expect(staffDashboardSource).toContain('Start with your schedule')
    expect(staffDashboardSource).toContain('Trade &amp; Coverage Requests')
    expect(staffDashboardSource).toContain('Past requests and outcomes')
    expect(staffDashboardSource).toContain('resolveTherapistWorkflow')
  })

  it('loads a preliminary or final schedule block for the primary staff schedule surface', () => {
    expect(staffDashboardSource).toContain('fetchStaffScheduleBlockView')
    expect(staffDashboardSource).toContain('siteLocalDateKey()')
    expect(staffDashboardSource).not.toContain('new Date().toISOString().slice(0, 10)')
    expect(staffDashboardSource).toContain("workflow.state === 'preliminary_review_available'")
    expect(staffDashboardSource).toContain("workflow.state === 'published_schedule_available'")
    expect(staffDashboardSource).toContain("cycle.status === 'preliminary'")
    expect(staffDashboardSource).toContain("cycle.published || cycle.status === 'final'")
  })

  it('keeps first-run staff out of the dashboard until onboarding is completed', () => {
    expect(staffDashboardSource).toContain('!profile?.staff_onboarding_completed_at')
    expect(staffDashboardSource).not.toContain(
      'profile?.staff_onboarding_required === true && !profile?.staff_onboarding_completed_at'
    )
  })
})
