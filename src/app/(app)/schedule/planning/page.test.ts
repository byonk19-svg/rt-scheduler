import fs from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const pagePath = resolve(process.cwd(), 'src/app/(app)/schedule/planning/page.tsx')
const source = fs.readFileSync(pagePath, 'utf8')

describe('Schedule Block Planning page source contract', () => {
  it('uses the manager-only scheduling action boundary', () => {
    expect(source).toContain('createScheduleBlockPlanningAction')
    expect(source).toContain('updateScheduleBlockPlanningAction')
    expect(source).toContain("can(parseRole(profile?.role), 'manage_schedule'")
    expect(source).toContain("redirect('/dashboard/staff')")
  })

  it('collects date-only planning fields without asking for times', () => {
    expect(source).toContain('name="availability_due_date"')
    expect(source).toContain('name="preliminary_target_date"')
    expect(source).toContain('name="final_publish_target_date"')
    expect(source).toContain('type="date"')
    expect(source).not.toContain('type="time"')
    expect(source).not.toContain('datetime-local')
  })

  it('keeps actual preliminary and publish actions out of the planning route', () => {
    expect(source).toContain('Create next schedule block')
    expect(source).toContain('Review or edit dates')
    expect(source).toContain('Missing historical targets')
    expect(source).not.toContain('sendPreliminary')
    expect(source).not.toContain('publishSchedule')
  })

  it('opens a linked planning block and carries earlier-due-date confirmation explicitly', () => {
    expect(source).toContain('const selectedCycleId = getSearchParam(params.cycle)')
    expect(source).toContain('pending_due_date')
    expect(source).toContain('confirm_earlier_due_date')
    expect(source).toContain('open={selected}')
    expect(source).toContain('Saving again confirms the earlier availability due date.')
  })

  it('shows lifecycle guard feedback for server-side action attempts', () => {
    expect(source).toContain('planning_block_not_future')
    expect(source).toContain('planning_lifecycle_locked')
    expect(source).toContain('Schedule Block Planning is only for future blocks.')
    expect(source).toContain('Planning dates are locked after the Schedule Block starts')
  })
})
