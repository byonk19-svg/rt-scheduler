import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const staffDashboardSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/dashboard/staff/page.tsx'),
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
