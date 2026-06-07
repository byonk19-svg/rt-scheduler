import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/availability',
  useRouter: () => ({
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams('tab=planner'),
}))

import { ManagerSchedulingInputs } from '@/components/availability/ManagerSchedulingInputs'

function renderManagerSchedulingInputs(
  cycle: {
    id: string
    label: string
    start_date: string
    end_date: string
    published: boolean
    availability_due_at?: string | null
    availability_closed_at?: string | null
    availability_reopened_at?: string | null
    status?: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
  },
  availabilityWindow?: {
    locked: boolean
    reason:
      | 'archived'
      | 'published'
      | 'offline'
      | 'preliminary'
      | 'manager_closed'
      | 'schedule_building_started'
      | null
  }
) {
  return renderToStaticMarkup(
    createElement(ManagerSchedulingInputs, {
      cycles: [cycle],
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
      initialCycleId: cycle.id,
      initialTherapistId: 'therapist-1',
      submittedRows: [],
      missingRows: [],
      saveManagerPlannerDatesAction: async () => {},
      saveManagerAvailabilityRequestsAction: async () => {},
      copyAvailabilityFromPreviousCycleAction: async () => {},
      availabilityWindow,
    })
  )
}

describe('ManagerSchedulingInputs', () => {
  it('renders the queue-first manager workspace with toolbar, queue, detail panel, and inline editor', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/availability/ManagerSchedulingInputs.tsx'),
      'utf8'
    )
    const panelSource = readFileSync(
      resolve(process.cwd(), 'src/components/availability/manager-availability-editor-panel.tsx'),
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
            availability_due_at: null,
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

    expect(html).toContain('Schedule Block')
    expect(html).toContain('Therapist search')
    expect(html).toContain('Availability Manager')
    expect(html).toContain('Manager draft')
    expect(html).toContain('Hidden from therapists until planning dates are set.')
    expect(html).toContain('href="/schedule/planning?cycle=cycle-1"')
    expect(html).not.toContain('Selected therapist</span><select')
    expect(source).toContain('AvailabilityStatusSummary')
    expect(source).toContain('reminderMissingCount={missingRows.length}')
    expect(source).toContain('TherapistContextPanel')
    expect(source).toContain('id="staff-scheduling-inputs"')
    expect(source).not.toContain('AvailabilityCalendarPanel')
    expect(source).toContain('saveManagerAvailabilityRequestsAction')
    expect(source).toContain('activeShift')
    expect(source).toContain('hasUnsavedChanges')
    expect(source).toContain("useState<AvailabilityEditorMode>('need_off')")
    expect(source).not.toContain('ManagerAvailabilityEditorDialog')
    expect(panelSource).toContain('Availability editor')
    expect(panelSource).toContain('Planning assumptions')
    expect(panelSource).toContain('Availability exceptions')
    expect(panelSource).toContain('Use Need Off or Need to Work for availability exceptions.')
    expect(panelSource).toContain('Copy previous block')
    expect(panelSource).toContain('handleCopyPreviousBlockClick')
    expect(panelSource).toContain('handleClearSelectedDates')
    expect(panelSource).toContain('confirmAvailabilityDestructiveAction')
    expect(panelSource).toContain('COPY_PREVIOUS_AVAILABILITY_CONFIRMATION')
    expect(panelSource).toContain('CLEAR_AVAILABILITY_CONFIRMATION')
    expect(panelSource).toContain('Available')
    expect(panelSource).toContain('Unavailable')
    expect(panelSource).toContain('Save for')
    expect(panelSource).toContain('data-availability-editor')
  })

  it('keeps reminder counts aligned with the full reminder action scope', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/availability/ManagerSchedulingInputs.tsx'),
      'utf8'
    )

    expect(source).toContain('reminderMissingCount={missingRows.length}')
    expect(source).not.toContain(
      'reminderMissingCount={filteredQueueRows.filter((row) => !row.submitted).length}'
    )
  })

  it('passes manager-entered availability provenance into the therapist detail panel', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/availability/ManagerSchedulingInputs.tsx'),
      'utf8'
    )
    const panelSource = readFileSync(
      resolve(process.cwd(), 'src/components/availability/therapist-context-panel.tsx'),
      'utf8'
    )

    expect(source).toContain('managerEnteredCount: rosterRow.managerEnteredCount ?? 0')
    expect(panelSource).toContain('Manager-entered')
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

    expect(html).toContain('No Schedule Block is ready for availability.')
    expect(html).toContain('Create or plan a Schedule Block')
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
    expect(source).toContain('window.history.replaceState')
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

  it('shows when availability collection is open to staff', () => {
    const html = renderManagerSchedulingInputs(
      {
        id: 'cycle-1',
        label: 'Apr 2026',
        start_date: '2026-03-22',
        end_date: '2026-05-02',
        published: false,
        availability_due_at: '2026-03-10',
      },
      { locked: false, reason: null }
    )

    expect(html).toContain('Availability open')
    expect(html).toContain('Availability collection is open to staff.')
  })

  it('shows when availability collection is locked to staff', () => {
    const html = renderManagerSchedulingInputs(
      {
        id: 'cycle-1',
        label: 'Apr 2026',
        start_date: '2026-03-22',
        end_date: '2026-05-02',
        published: false,
        availability_due_at: '2026-03-10',
        availability_closed_at: '2026-03-11T12:00:00.000Z',
      },
      { locked: true, reason: 'manager_closed' }
    )

    expect(html).toContain('Availability locked')
    expect(html).toContain('Availability collection is locked to staff.')
  })

  it('shows when availability was reopened for late changes', () => {
    const html = renderManagerSchedulingInputs(
      {
        id: 'cycle-1',
        label: 'Apr 2026',
        start_date: '2026-03-22',
        end_date: '2026-05-02',
        published: false,
        availability_due_at: '2026-03-10',
        availability_closed_at: '2026-03-11T12:00:00.000Z',
        availability_reopened_at: '2026-03-12T12:00:00.000Z',
      },
      { locked: false, reason: null }
    )

    expect(html).toContain('Availability reopened')
    expect(html).toContain('Availability was reopened for late changes.')
  })

  it('shows when the schedule has been posted', () => {
    const html = renderManagerSchedulingInputs(
      {
        id: 'cycle-1',
        label: 'Apr 2026',
        start_date: '2026-03-22',
        end_date: '2026-05-02',
        published: true,
        availability_due_at: '2026-03-10',
      },
      { locked: true, reason: 'published' }
    )

    expect(html).toContain('Schedule posted')
    expect(html).toContain('Schedule has been posted.')
  })
})
