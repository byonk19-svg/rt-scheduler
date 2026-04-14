import fs from 'node:fs'
import path from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { EmployeeRosterPanel } from '@/components/team/EmployeeRosterPanel'

const teamPageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/team/page.tsx'), 'utf8')

describe('EmployeeRosterPanel', () => {
  it('renders phone capture and therapist roster replacement forms', () => {
    const html = renderToStaticMarkup(
      createElement(EmployeeRosterPanel, {
        roster: [
          {
            id: 'roster-1',
            full_name: 'Jane Doe',
            role: 'therapist',
            shift_type: 'day',
            employment_type: 'full_time',
            max_work_days_per_week: 3,
            is_lead_eligible: false,
            matched_profile_id: null,
            matched_at: null,
          },
        ],
        upsertEmployeeRosterEntryAction: async () => {},
        bulkUpsertEmployeeRosterAction: async () => {},
        replaceTherapistRosterAction: async () => {},
        deleteEmployeeRosterEntryAction: async () => {},
      })
    )

    expect(html).toContain('Phone number')
    expect(html).toContain('name="phone_number"')
    expect(html).toContain('Therapist roster replacement')
    expect(html).toContain('name="therapist_roster_source"')
    expect(html).toContain('Replace therapist roster')
    expect(html).toContain('Brooks, Tannie 903-217-7833')
  })
})

describe('Team page source contract', () => {
  it('wires the therapist roster replacement action through the employee roster panel', () => {
    expect(teamPageSource).toContain('replaceTherapistRosterAction')
    expect(teamPageSource).toContain(
      'replaceTherapistRosterAction={replaceTherapistRosterAction}'
    )
  })
})
