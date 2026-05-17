import fs from 'node:fs'
import path from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { EmployeeRosterPanel } from '@/components/team/EmployeeRosterPanel'

const teamPageSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/team/page.tsx'),
  'utf8'
)

const rosterPanelSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/team/EmployeeRosterPanel.tsx'),
  'utf8'
)

describe('EmployeeRosterPanel', () => {
  it('captures phone on add-employee and exposes therapist roster replacement', () => {
    expect(rosterPanelSource).toContain('name="phone_number"')
    expect(rosterPanelSource).toContain('Replace therapist roster')
    expect(rosterPanelSource).toContain('name="therapist_roster_source"')
    expect(rosterPanelSource).toContain('Bulk tools')
  })

  it('renders roster table, import tools, and the grouped high-risk utility area in markup', () => {
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
            matched_email: null,
            matched_at: null,
            phone_number: null,
          },
        ],
        upsertEmployeeRosterEntryAction: async () => {},
        bulkUpsertEmployeeRosterAction: async () => {},
        replaceTherapistRosterAction: async () => {},
        deleteEmployeeRosterEntryAction: async () => {},
      })
    )

    expect(html).toContain('Phone</button>')
    expect(html).toContain('name="therapist_roster_source"')
    expect(html).toContain('Replace therapist roster')
    expect(html).toContain('Brooks, Tannie 903-217-7833')
    expect(html).toContain('Add employee')
    expect(html).toContain('Import tools')
    expect(html).toContain('Bulk tools')
    expect(html).toContain('High-risk utility')
  })

  it('gives a next step when the employee roster is empty', () => {
    const tableSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/team/employee-roster-table.tsx'),
      'utf8'
    )

    expect(tableSource).toContain('No roster entries yet.')
    expect(tableSource).toContain('Add employees manually or use bulk import')
  })
})

describe('Team page source contract', () => {
  it('wires the therapist roster replacement action through the employee roster panel', () => {
    expect(teamPageSource).toContain('replaceTherapistRosterAction')
    expect(teamPageSource).toContain('replaceTherapistRosterAction={replaceTherapistRosterAction}')
  })

  it('adds an Import link from the team page', () => {
    expect(teamPageSource).toContain('href="/team/import"')
  })
})
