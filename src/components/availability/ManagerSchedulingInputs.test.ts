import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ManagerSchedulingInputs } from '@/components/availability/ManagerSchedulingInputs'

describe('ManagerSchedulingInputs', () => {
  it('renders the manager workspace with planner controls, calendar, and roster content', () => {
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

    expect(html).toContain('data-slot="availability-workspace-primary"')
    expect(html).toContain('Plan staffing')
    expect(html).toContain('Schedule cycle')
    expect(html).toContain('Therapist')
    expect(html).toContain('Will work')
    expect(html).toContain('Cannot work')
    expect(html).toContain('Copy from last block')
    expect(html).toContain('Selected dates')
    expect(html).toContain('Save 1 will-work date')
    expect(html).toContain('March 2026')
    expect(html).toContain('Selected therapist')
    expect(html).toContain('Current cycle')
    expect(html).toContain('Therapist context')
    expect(html).toContain('Request summary')
    expect(html).toContain('Recent requests')
    expect(html).toContain('Response roster')
    expect(html).toContain('Request inbox')
    expect(html).toContain('Layne P.')
    expect(html).toContain('Barbara C.')
    expect(html).toContain('Mar 24, 2026')
    expect(html).toContain('Mar 26, 2026')
    expect(html).toContain('data-slot="availability-workspace-context"')
    expect(html).toContain('data-slot="availability-workspace-secondary"')
  })

  it('renders a setup message when no cycles exist', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerSchedulingInputs, {
        cycles: [],
        therapists: [],
        overrides: [],
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

  it('uses a clearer disabled save label when no planner dates are selected', () => {
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
        overrides: [],
        availabilityEntries: [],
        initialCycleId: 'cycle-1',
        initialTherapistId: 'therapist-1',
        submittedRows: [],
        missingRows: [],
        saveManagerPlannerDatesAction: async () => {},
        deleteManagerPlannerDateAction: async () => {},
        copyAvailabilityFromPreviousCycleAction: async () => {},
      })
    )

    expect(html).toContain('Select dates to save')
    expect(html).not.toContain('Save 0 will-work dates')
  })
})
