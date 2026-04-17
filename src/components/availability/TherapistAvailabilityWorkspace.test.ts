import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TherapistAvailabilityWorkspace } from '@/components/availability/TherapistAvailabilityWorkspace'

describe('TherapistAvailabilityWorkspace', () => {
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
    expect(html).not.toContain('You marked Need Off on')
    expect(html).toContain('request to work')
    expect(html).toContain('Week 1')
    expect(html).not.toContain('Must work')
    expect(html).not.toContain('Unavailable')
  })

  it('renders the scheduled conflict warning banner when selected-cycle conflicts are present', () => {
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

    expect(html).toContain('You marked Need Off on')
    expect(html).toContain('Mon Apr 20')
    expect(html).toContain('Review in Coverage')
  })

  it('documents that Available days do not persist notes (source)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/availability/TherapistAvailabilityWorkspace.tsx'),
      'utf8'
    )
    expect(src).toContain('Notes are only saved for Need Off or Request to Work days.')
    expect(src).toContain('Persisted notes only exist for Need Off')
  })
})
