import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function read(filePath: string): string {
  return readFileSync(resolve(process.cwd(), filePath), 'utf8')
}

const routes = [
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
  ['src/app/(app)/coverage/page.tsx', "title: 'Schedule'"],
  ['src/app/(app)/schedule/page.tsx', "title: 'Team Schedule'"],
  ['src/app/(app)/approvals/page.tsx', "title: 'Approvals'"],
  ['src/app/(app)/analytics/page.tsx', "title: 'Analytics'"],
  ['src/app/(app)/profile/page.tsx', "title: 'Profile'"],
  ['src/app/(app)/settings/audit-log/page.tsx', "title: 'Audit Log'"],
  ['src/app/(app)/therapist/schedule/page.tsx', "title: 'Schedule'"],
  ['src/app/(app)/therapist/availability/page.tsx', "title: 'Future Availability'"],
  ['src/app/(app)/therapist/swaps/page.tsx', "title: 'Shift Swaps & Pickups'"],
  ['src/app/(app)/staff/my-schedule/page.tsx', "title: 'Schedule'"],
  ['src/app/(app)/staff/schedule/page.tsx', "title: 'Schedule'"],
  ['src/app/(app)/staff/history/page.tsx', "title: 'Shift Swaps & Pickups History'"],
  ['src/app/(app)/shift-board/page.tsx', "title: 'Shift Board'"],
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
  it('/schedule uses the canonical Team Schedule title', () => {
    const source = read('src/app/(app)/schedule/page.tsx')
    expect(source).toContain("title: 'Team Schedule'")
    expect(source).not.toContain('>Schedule roster<')
    expect(source).not.toContain('>Roster view<')
  })

  it('/therapist/schedule, /staff/schedule, and /staff/my-schedule redirect to Schedule', () => {
    const therapistSchedule = read('src/app/(app)/therapist/schedule/page.tsx')
    const staffSchedule = read('src/app/(app)/staff/schedule/page.tsx')
    const staffMySchedule = read('src/app/(app)/staff/my-schedule/page.tsx')

    expect(therapistSchedule).toContain('buildScheduleRedirectPath')
    expect(staffSchedule).toContain('buildScheduleRedirectPath')
    expect(staffMySchedule).toContain('buildScheduleRedirectPath')
    expect(therapistSchedule).toContain("title: 'Schedule'")
    expect(staffSchedule).toContain("title: 'Schedule'")
    expect(staffMySchedule).toContain("title: 'Schedule'")
    expect(therapistSchedule).not.toContain('"My Shifts"')
    expect(staffMySchedule).not.toContain('"My Shifts"')
  })

  it('/shift-board is the canonical board while /therapist/swaps keeps legacy therapist wording', () => {
    const shiftBoard = read('src/app/(app)/shift-board/page.tsx')
    const therapistSwaps = read('src/app/(app)/therapist/swaps/page.tsx')
    expect(shiftBoard).toContain("title: 'Shift Board'")
    expect(therapistSwaps).toContain("title: 'Shift Swaps & Pickups'")
  })

  it('/coverage redirects into the canonical Schedule surface', () => {
    const coverage = read('src/app/(app)/coverage/page.tsx')
    const schedule = read('src/app/(app)/schedule/page.tsx')
    expect(coverage).toContain("title: 'Schedule'")
    expect(schedule).toContain("title: 'Team Schedule'")
    expect(coverage).toContain('buildScheduleRedirectPath(params, { preserveAll: true })')
    expect(schedule).not.toContain("title: 'Coverage'")
  })

  it('/coverage metadata describes redirect behavior', () => {
    const coverageLayout = read('src/app/(app)/coverage/layout.tsx')

    expect(coverageLayout).toContain('Redirects to the unified Schedule grid.')
  })
})
