import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) =>
    createElement('a', { href, ...props }, children),
}))

import { TherapistAvailabilityWorkspace } from '@/components/availability/TherapistAvailabilityWorkspace'

describe('TherapistAvailabilityWorkspace', () => {
  it('renders therapist-only controls with simpler normal-schedule and cycle-change language', () => {
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
        recurringPatternSummary:
          'Works Mon, Tue, Thu, Fri. Every other weekend starting May 2, 2026.',
        generatedBaselineByCycleId: {
          'cycle-1': {
            '2026-03-23': {
              baselineStatus: 'available',
              baselineSource: 'recurring_pattern',
              reason: 'allowed',
            },
            '2026-03-24': {
              baselineStatus: 'available',
              baselineSource: 'recurring_pattern',
              reason: 'allowed',
            },
          },
        },
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('Future Availability')
    expect(html).toContain('Starting point for this cycle')
    expect(html).toContain('We used your normal schedule to fill this cycle.')
    expect(html).toContain('Changes here stay in this cycle only.')
    expect(html).toContain('Works Mon, Tue, Thu, Fri. Every other weekend starting May 2, 2026.')
    expect(html).toContain('Submit availability')
    expect(html).toContain('id="therapist-availability-workspace"')
    expect(html).toContain('Not submitted')
    expect(html).toContain('Cycle:')
    expect(html).not.toContain('days selected')
    expect(html).toContain('Click a day to make a change.')
    expect(html).toContain('From your normal schedule')
    expect(html).toContain('This cycle only')
    expect(html).not.toContain('panel on the right')
    expect(html).toContain('Optional note')
    expect(html).toContain('Mar')
    expect(html).toContain('Apr')
    expect(html).not.toContain('Request to Work')
    expect(html).not.toContain('Need Off')
    expect(html).toContain('can work')
    expect(html).toContain('Reset this cycle to normal schedule')
    expect(html).toContain('Edit several days')
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
        recurringPatternSummary: 'No normal schedule saved yet.',
        generatedBaselineByCycleId: { 'cycle-1': {} },
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('You marked Need Off on dates that already have a scheduled shift.')
    expect(html).toContain('Mon Apr 20')
    expect(html).toContain('Review in Coverage')
  })

  it('uses neutral manual-state language when no normal schedule exists', () => {
    const html = renderToStaticMarkup(
      createElement(TherapistAvailabilityWorkspace, {
        cycles: [
          {
            id: 'cycle-1',
            label: 'Apr 2026',
            start_date: '2026-04-24',
            end_date: '2026-05-07',
            published: true,
          },
        ],
        availabilityRows: [],
        conflicts: [],
        initialCycleId: 'cycle-1',
        recurringPatternSummary: 'No normal schedule saved yet.',
        generatedBaselineByCycleId: { 'cycle-1': {} },
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('This cycle starts blank.')
    expect(html).toContain('Choose the days you can or cannot work.')
    expect(html).toContain('Not set yet')
    expect(html).not.toContain('From your normal schedule')
  })

  it('documents that Available days do not persist notes (source)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/availability/TherapistAvailabilityWorkspace.tsx'),
      'utf8'
    )
    expect(src).toContain('Notes are only saved for days you change for this cycle.')
    expect(src).toContain('Edit several days')
  })
})
