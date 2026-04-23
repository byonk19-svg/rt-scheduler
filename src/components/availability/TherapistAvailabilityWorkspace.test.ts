import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TherapistAvailabilityWorkspace } from '@/components/availability/TherapistAvailabilityWorkspace'

const workspaceSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/TherapistAvailabilityWorkspace.tsx'),
  'utf8'
)
const calendarSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/TherapistAvailabilityCalendar.tsx'),
  'utf8'
)
const weekSectionSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/TherapistAvailabilityWeekSection.tsx'),
  'utf8'
)
const selectedDayEditorSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/TherapistAvailabilitySelectedDayEditor.tsx'),
  'utf8'
)
const notesSummarySource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/TherapistAvailabilityNotesSummary.tsx'),
  'utf8'
)

describe('TherapistAvailabilityWorkspace', () => {
  it('renders CTAs when no cycle exists yet', () => {
    const html = renderToStaticMarkup(
      createElement(TherapistAvailabilityWorkspace, {
        cycles: [],
        availabilityRows: [],
        conflicts: [],
        initialCycleId: '',
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('id="therapist-availability-workspace"')
    expect(html).toContain('href="/dashboard/staff"')
    expect(html).toContain('href="/shift-board"')
    expect(html).toContain('href="/staff/my-schedule"')
  })

  it('renders therapist-only controls, summary, and full-availability status copy', () => {
    const html = renderToStaticMarkup(
      createElement(TherapistAvailabilityWorkspace, {
        cycles: [
          {
            id: 'cycle-1',
            label: 'Apr 2026',
            start_date: '2026-03-22',
            end_date: '2026-05-02',
            published: false,
          },
        ],
        availabilityRows: [
          {
            id: 'entry-1',
            therapistId: 'therapist-1',
            cycleId: 'cycle-1',
            date: '2026-03-24',
            reason: 'Vacation',
            createdAt: '2026-03-02T08:00:00.000Z',
            updatedAt: '2026-03-02T08:00:00.000Z',
            requestedBy: 'Barbara C.',
            cycleLabel: 'Apr 2026 (2026-03-22 to 2026-05-02)',
            entryType: 'force_off',
            shiftType: 'both',
            canDelete: true,
          },
        ],
        conflicts: [],
        initialCycleId: 'cycle-1',
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('Availability for This Cycle')
    expect(html).toContain('Submit availability')
    expect(html).toContain('id="therapist-availability-workspace"')
    expect(html).toContain('Not submitted')
    expect(html).toContain('Cycle:')
    expect(html).not.toContain('days selected')
    expect(html).toContain('Availability summary:')
    expect(html).toContain('Tap a day to switch between Available, Need Off, and Request to Work.')
    expect(html).toContain('appear below the selected week')
    expect(html).toContain('Day Notes')
    expect(html).toContain('Mar')
    expect(html).toContain('Apr')
    expect(html).toContain('Request to Work')
    expect(html).toContain('Need Off')
    expect(html).toContain('request to work')
    expect(html).toContain('Week 1')
    expect(html).not.toContain('Must work')
    expect(html).not.toContain('Unavailable')
  })

  it('renders the scheduled conflict warning banner when conflicts are present', () => {
    const html = renderToStaticMarkup(
      createElement(TherapistAvailabilityWorkspace, {
        cycles: [
          {
            id: 'cycle-1',
            label: 'Apr 2026',
            start_date: '2026-04-19',
            end_date: '2026-04-25',
            published: false,
          },
        ],
        availabilityRows: [],
        conflicts: [{ date: '2026-04-20', shiftType: 'day' }],
        initialCycleId: 'cycle-1',
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('You marked Need Off on dates that already have a scheduled shift.')
    expect(html).toContain('Mon Apr 20')
    expect(html).toContain('Review in Coverage')
  })

  it('documents that Available days do not persist notes (source)', () => {
    const draftSrc = readFileSync(
      resolve(process.cwd(), 'src/lib/therapist-availability-draft.ts'),
      'utf8'
    )
    const stateSrc = readFileSync(
      resolve(process.cwd(), 'src/components/availability/useTherapistAvailabilityState.ts'),
      'utf8'
    )
    expect(weekSectionSource).toContain('TherapistAvailabilitySelectedDayEditor')
    expect(selectedDayEditorSource).toContain(
      'Notes are only saved for Need Off or Request to Work days.'
    )
    expect(draftSrc).toContain('Persisted notes only exist for Need Off')
    expect(stateSrc).toContain('useTherapistAvailabilityState')
    expect(workspaceSource).toContain('useTherapistAvailabilityState')
  })

  it('keeps week grid rendering in a dedicated calendar section component', () => {
    expect(calendarSource).toContain('TherapistAvailabilityWeekSection')
    expect(weekSectionSource).toContain('Week {weekIndex + 1}')
    expect(weekSectionSource).toContain(
      'aria-label={`${formatDateLabel(date)}: ${therapistDayStatusLabel(status)}`}'
    )
  })

  it('keeps the day-notes summary in a dedicated component', () => {
    expect(workspaceSource).toContain('TherapistAvailabilityNotesSummary')
    expect(notesSummarySource).toContain('Day Notes')
    expect(notesSummarySource).toContain('No day-specific notes yet.')
  })
})
