import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function read(filePath: string): string {
  return readFileSync(resolve(process.cwd(), filePath), 'utf8')
}

const routes = [
  // Pre-existing
  ['src/app/(app)/dashboard/page.tsx', "title: 'Dashboard'"],
  ['src/app/(app)/dashboard/manager/page.tsx', "title: 'Dashboard'"],
  ['src/app/(app)/dashboard/staff/page.tsx', "title: 'Dashboard'"],
  ['src/app/(app)/availability/page.tsx', "title: 'Availability Manager'"],
  ['src/app/(app)/pending-setup/page.tsx', "title: 'Waiting for approval'"],
  ['src/app/(app)/publish/page.tsx', "title: 'Publish History'"],
  ['src/app/(app)/requests/page.tsx', "title: 'Requests'"],
  ['src/app/(app)/requests/user-access/page.tsx', "title: 'User Access Requests'"],
  ['src/app/(app)/team/page.tsx', "title: 'Team'"],
  ['src/app/(app)/lottery/page.tsx', "title: 'Lottery'"],
  // Manager schedule section
  ['src/app/(app)/coverage/page.tsx', "title: 'Coverage'"],
  ['src/app/(app)/schedule/page.tsx', "title: 'Schedule Roster'"],
  ['src/app/(app)/approvals/page.tsx', "title: 'Approvals'"],
  ['src/app/(app)/analytics/page.tsx', "title: 'Analytics'"],
  // Profile / settings
  ['src/app/(app)/profile/page.tsx', "title: 'Profile'"],
  ['src/app/(app)/settings/audit-log/page.tsx', "title: 'Audit Log'"],
  // Therapist routes
  ['src/app/(app)/therapist/schedule/page.tsx', "title: 'My Shifts'"],
  ['src/app/(app)/therapist/availability/page.tsx', "title: 'Future Availability'"],
  ['src/app/(app)/therapist/swaps/page.tsx', "title: 'Shift Swaps & Pickups'"],
  // Staff compat routes — must match their canonical counterparts
  ['src/app/(app)/staff/my-schedule/page.tsx', "title: 'My Shifts'"],
  ['src/app/(app)/staff/history/page.tsx', "title: 'Shift Swaps & Pickups History'"],
  // Manager shift board
  ['src/app/(app)/shift-board/page.tsx', "title: 'Shift Swaps & Pickups'"],
] as const

describe('app route metadata sweep', () => {
  it('sets route-specific titles on the remaining high-traffic server pages', () => {
    for (const [filePath, titleSnippet] of routes) {
      const source = read(filePath)
      expect(source, `${filePath} missing metadata title`).toContain(titleSnippet)
    }
  })
})

describe('route title consistency', () => {
  it('/schedule empty-state h1 matches its metadata title casing (Schedule Roster)', () => {
    const source = read('src/app/(app)/schedule/page.tsx')
    // Metadata title uses title case
    expect(source).toContain("title: 'Schedule Roster'")
    // h1 in the no-cycle empty state must match — not lowercase "roster"
    expect(source).not.toContain('>Schedule roster<')
  })

  it('/staff/my-schedule and /therapist/schedule both render "My Shifts" as their page title', () => {
    const mySchedule = read('src/app/(app)/staff/my-schedule/page.tsx')
    const therapistSchedule = read('src/app/(app)/therapist/schedule/page.tsx')
    expect(mySchedule).toContain('"My Shifts"')
    expect(therapistSchedule).toContain('"My Shifts"')
    // Old divergent name must be gone
    expect(mySchedule).not.toContain('"My Schedule"')
  })

  it('/shift-board and /therapist/swaps share the same "Shift Swaps & Pickups" title', () => {
    const shiftBoard = read('src/app/(app)/shift-board/page.tsx')
    const therapistSwaps = read('src/app/(app)/therapist/swaps/page.tsx')
    expect(shiftBoard).toContain("title: 'Shift Swaps & Pickups'")
    expect(therapistSwaps).toContain("title: 'Shift Swaps & Pickups'")
  })

  it('/coverage (editable) and /schedule (read-only) have distinct metadata titles', () => {
    const coverage = read('src/app/(app)/coverage/page.tsx')
    const schedule = read('src/app/(app)/schedule/page.tsx')
    expect(coverage).toContain("title: 'Coverage'")
    expect(schedule).toContain("title: 'Schedule Roster'")
    // They must not share the same title
    expect(coverage).not.toContain("title: 'Schedule Roster'")
    expect(schedule).not.toContain("title: 'Coverage'")
  })
})
