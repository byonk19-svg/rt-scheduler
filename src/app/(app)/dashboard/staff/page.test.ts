import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const staffDashboardSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/dashboard/staff/page.tsx'),
  'utf8'
)
const staffDashboardHeroSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/staff/StaffDashboardHero.tsx'),
  'utf8'
)
const staffDashboardSummaryCardsSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/staff/StaffDashboardSummaryCards.tsx'),
  'utf8'
)
const staffDashboardPublishedShiftsSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/staff/StaffDashboardPublishedShifts.tsx'),
  'utf8'
)

describe('staff dashboard future availability links', () => {
  it('sends staff users to the dedicated therapist availability route', () => {
    expect(staffDashboardHeroSource).toContain('/therapist/availability')
    expect(staffDashboardSummaryCardsSource).toContain('/therapist/availability')
    expect(staffDashboardSource).not.toContain('href="/availability"')
  })

  it('uses the admin client to resolve coworker names for the published schedule preview', () => {
    expect(staffDashboardSource).toContain('createAdminClient')
    expect(staffDashboardSource).toContain(".in('id', rosterUserIds)")
  })
})

describe('staff dashboard availability stat card', () => {
  it('marks the availability card as pending when the source code has conditional warning treatment', () => {
    expect(staffDashboardSummaryCardsSource).toContain('availabilitySubmitted')
    expect(staffDashboardSummaryCardsSource).toContain('var(--warning-subtle)')
    expect(staffDashboardSummaryCardsSource).toContain('var(--warning-border)')
  })
})

describe('staff dashboard therapist action-center copy', () => {
  it('uses human cycle labeling and availability-for-cycle language', () => {
    expect(staffDashboardHeroSource).toContain('Cycle:')
    expect(staffDashboardSummaryCardsSource).toContain('Availability for This Cycle')
    expect(staffDashboardHeroSource).toContain('requests awaiting action')
    expect(staffDashboardHeroSource).toContain('Browse open shifts')
    expect(staffDashboardSource).toContain("'therapist_availability_submissions'")
    expect(staffDashboardHeroSource).toContain('Welcome,')
    expect(staffDashboardSource).toContain('formatHumanCycleRange')
  })

  it('keeps the hero action center in a dedicated component', () => {
    expect(staffDashboardHeroSource).toContain('Welcome,')
    expect(staffDashboardHeroSource).toContain('Upcoming Shifts')
    expect(staffDashboardHeroSource).toContain('Browse open shifts')
    expect(staffDashboardSource).toContain('StaffDashboardHero')
  })

  it('keeps the summary stat cards in a dedicated component', () => {
    expect(staffDashboardSummaryCardsSource).toContain('Next Shift')
    expect(staffDashboardSummaryCardsSource).toContain('Availability for This Cycle')
    expect(staffDashboardSummaryCardsSource).toContain('Requests Awaiting Action')
    expect(staffDashboardSource).toContain('StaffDashboardSummaryCards')
  })

  it('keeps the published shifts list in a dedicated component', () => {
    expect(staffDashboardPublishedShiftsSource).toContain('Upcoming shifts')
    expect(staffDashboardPublishedShiftsSource).toContain('Browse open shifts')
    expect(staffDashboardSource).toContain('StaffDashboardPublishedShifts')
  })
})
