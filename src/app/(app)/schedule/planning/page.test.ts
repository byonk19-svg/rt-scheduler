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
    expect(source).toContain('Next suggested Schedule Block')
    expect(source).toContain('This is a preview. It is not saved until you confirm the dates.')
    expect(source).not.toContain('sendPreliminary')
    expect(source).not.toContain('publishSchedule')
  })
})
