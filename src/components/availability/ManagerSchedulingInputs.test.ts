import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ManagerSchedulingInputs } from '@/components/availability/ManagerSchedulingInputs'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/availability/ManagerSchedulingInputs.tsx'),
  'utf8'
)

describe('ManagerSchedulingInputs', () => {
  it('renders the manager workspace shell for the planner surface', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerSchedulingInputs, {
        cycles: [
          {
            id: 'cycle-1',
            label: 'Apr 2026',
            start_date: '2026-03-22',
            end_date: '2026-05-02',
            published: false,
          },
        ],
        therapists: [
          {
            id: 'therapist-1',
            full_name: 'Barbara C.',
            shift_type: 'day',
            employment_type: 'full_time',
          },
        ],
        overrides: [
          {
            id: 'override-1',
            therapist_id: 'therapist-1',
            cycle_id: 'cycle-1',
            date: '2026-03-24',
            shift_type: 'day',
            override_type: 'force_on',
            note: null,
            source: 'manager',
          },
          {
            id: 'override-2',
            therapist_id: 'therapist-1',
            cycle_id: 'cycle-1',
            date: '2026-03-26',
            shift_type: 'day',
            override_type: 'force_off',
            note: null,
            source: 'manager',
          },
        ],
        workPatternsByTherapist: {},
        availabilityEntries: [
          {
            id: 'entry-1',
            therapistId: 'therapist-1',
            cycleId: 'cycle-1',
            date: '2026-03-24',
            reason: 'Vacation',
            createdAt: '2026-03-02T08:00:00.000Z',
            updatedAt: '2026-03-03T08:00:00.000Z',
            requestedBy: 'Barbara C.',
            entryType: 'force_off',
          },
        ],
        initialCycleId: 'cycle-1',
        initialTherapistId: 'therapist-1',
        submittedRows: [
          {
            therapistId: 'submitted-1',
            therapistName: 'Kim S.',
            overridesCount: 3,
            lastUpdatedAt: '2026-03-20T09:00:00.000Z',
          },
        ],
        missingRows: [
          {
            therapistId: 'missing-1',
            therapistName: 'Layne P.',
            overridesCount: 0,
            lastUpdatedAt: null,
          },
        ],
        saveManagerPlannerDatesAction: async () => {},
        deleteManagerPlannerDateAction: async () => {},
        copyAvailabilityFromPreviousCycleAction: async () => {},
      })
    )

    expect(html).toContain('id="staff-scheduling-inputs"')
    expect(html).toContain('data-slot="availability-workspace-primary"')
    expect(html).toContain('Planning workspace')
    expect(html).toContain('Plan staffing')
    expect(html).toContain('selected therapist inside the current schedule cycle')
    expect(html).toContain('data-slot="availability-workspace-context"')
    expect(html).toContain('data-slot="availability-workspace-secondary"')
    expect(source).toContain('defaultOpen={defaultSecondaryOpen}')
  })

  it('renders a setup message when no cycles exist', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerSchedulingInputs, {
        cycles: [],
        therapists: [],
        overrides: [],
        workPatternsByTherapist: {},
        availabilityEntries: [],
        initialCycleId: '',
        initialTherapistId: '',
        submittedRows: [],
        missingRows: [],
        saveManagerPlannerDatesAction: async () => {},
        deleteManagerPlannerDateAction: async () => {},
        copyAvailabilityFromPreviousCycleAction: async () => {},
      })
    )

    expect(html).toContain('Create a schedule cycle before planning hard staffing dates.')
  })

  it('forwards deep-link state into the secondary workspace boundary', () => {
    expect(source).toContain("defaultSecondaryTab?: 'roster' | 'inbox'")
    expect(source).toContain('defaultSecondaryOpen?: boolean')
    expect(source).toContain('defaultOpen={defaultSecondaryOpen}')
  })
})
