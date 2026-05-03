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
  it('renders the queue-first manager workspace with toolbar, queue, and detail panel', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/availability/ManagerSchedulingInputs.tsx'),
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
        ],
        availabilityEntries: [
          {
            id: 'entry-1',
            therapistId: 'therapist-1',
            cycleId: 'cycle-1',
            date: '2026-03-24',
            reason: 'Vacation',
            createdById: 'manager-1',
            createdAt: '2026-03-02T08:00:00.000Z',
            updatedAt: '2026-03-03T08:00:00.000Z',
            requestedBy: 'Barbara C.',
            entryType: 'force_off',
            shiftType: 'both',
            source: 'therapist',
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
            shiftType: 'day',
            employmentType: 'full_time',
          },
        ],
        missingRows: [
          {
            therapistId: 'missing-1',
            therapistName: 'Layne P.',
            overridesCount: 0,
            lastUpdatedAt: null,
            shiftType: 'day',
            employmentType: 'prn',
          },
        ],
        saveManagerPlannerDatesAction: async () => {},
        saveManagerAvailabilityRequestsAction: async () => {},
        copyAvailabilityFromPreviousCycleAction: async () => {},
      })
    )

    expect(html).toContain('Schedule cycle')
    expect(html).toContain('Therapist search')
    expect(html).toContain('Availability Manager')
    expect(html).not.toContain('Selected therapist</span><select')
    expect(source).toContain('AvailabilityStatusSummary')
    expect(source).toContain('TherapistContextPanel')
    expect(source).toContain('ManagerAvailabilityEditorDialog')
    expect(source).toContain('id="staff-scheduling-inputs"')
    expect(source).not.toContain('AvailabilityCalendarPanel')
    expect(source).toContain('saveManagerAvailabilityRequestsAction')
    expect(source).toContain('editorOpen')
    expect(source).toContain('activeShift')
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
        saveManagerAvailabilityRequestsAction: async () => {},
        copyAvailabilityFromPreviousCycleAction: async () => {},
      })
    )

    expect(html).toContain('Create a schedule cycle before managing therapist availability.')
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

  it('keeps the follow-up workflow inside the queue instead of a buried lower panel', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/availability/ManagerSchedulingInputs.tsx'),
      'utf8'
    )

    expect(source).not.toContain('AvailabilitySecondaryPanel')
    expect(source).not.toContain('reviewRequestsPanel')
    expect(source).toContain('AvailabilityStatusSummary')
    expect(source).toContain('TherapistContextPanel')
  })
})
