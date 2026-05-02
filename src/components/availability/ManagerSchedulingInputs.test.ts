import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/availability',
  useRouter: () => ({
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams('tab=planner'),
}))

import { ManagerSchedulingInputs } from '@/components/availability/ManagerSchedulingInputs'

describe('ManagerSchedulingInputs', () => {
  it('renders the manager workspace with planner controls, calendar, and roster content', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/availability/ManagerSchedulingInputs.tsx'),
      'utf8'
    )
    const plannerRailSource = readFileSync(
      resolve(process.cwd(), 'src/components/availability/planner-control-rail.tsx'),
      'utf8'
    )
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
    expect(html).toContain('Planning workspace')
    expect(html).toContain('Plan one therapist at a time')
    expect(html).toContain('data-slot="availability-workspace-context"')
    expect(html).toContain('data-slot="availability-workspace-secondary"')
    expect(source).toContain('PlannerControlRail')
    expect(source).toContain('AvailabilityCalendarPanel')
    expect(source).toContain('TherapistContextPanel')
    expect(source).toContain('AvailabilitySecondaryPanel')
    expect(plannerRailSource).toContain('Schedule cycle')
    expect(plannerRailSource).toContain('Therapist')
    expect(plannerRailSource).toContain('Step 1')
    expect(plannerRailSource).toContain('Choose a therapist')
    expect(plannerRailSource).toContain('Step 2')
    expect(plannerRailSource).toContain('Step 3')
    expect(plannerRailSource).toContain('Will work')
    expect(plannerRailSource).toContain('Cannot work')
    expect(plannerRailSource).toContain('Copy from last block')
    expect(plannerRailSource).toContain('Selected dates')
    expect(plannerRailSource).toContain(
      "return `Save ${count} will-work date${count === 1 ? '' : 's'}`"
    )
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
    const plannerRailSource = readFileSync(
      resolve(process.cwd(), 'src/components/availability/planner-control-rail.tsx'),
      'utf8'
    )

    expect(plannerRailSource).toContain("if (count === 0) return 'Select dates to save'")
    expect(plannerRailSource).not.toContain('Save 0 will-work dates')
  })

  it('uses Next router state instead of forcing a full page reload for planner selection changes', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/availability/ManagerSchedulingInputs.tsx'),
      'utf8'
    )

    expect(source).toContain("from 'next/navigation'")
    expect(source).toContain('useRouter()')
    expect(source).toContain('usePathname()')
    expect(source).toContain('useSearchParams()')
    expect(source).toContain('router.replace(')
    expect(source).toContain('{ scroll: false }')
    expect(source).not.toContain('window.location.assign')
  })

  it('keeps the missing-response workflow in the follow-up queue instead of duplicating it in planner controls', () => {
    const plannerRailSource = readFileSync(
      resolve(process.cwd(), 'src/components/availability/planner-control-rail.tsx'),
      'utf8'
    )
    const rosterSource = readFileSync(
      resolve(process.cwd(), 'src/components/availability/AvailabilityStatusSummary.tsx'),
      'utf8'
    )

    expect(plannerRailSource).not.toContain('Focus missing responders')
    expect(plannerRailSource).not.toContain('Review next')
    expect(rosterSource).toContain('Focus missing responders')
    expect(rosterSource).toContain('Review next')
  })

  it('keeps the response roster synced to the active planner therapist', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/availability/ManagerSchedulingInputs.tsx'),
      'utf8'
    )

    expect(source).toContain('selectedTherapistId={selectedTherapistId}')
    expect(source).toContain('activeFilter={activeRosterFilter}')
    expect(source).toContain('activeTab={activeSecondaryTab}')
  })
})
