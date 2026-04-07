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
        initialCycleId: 'cycle-1',
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('Submit Availability')
    expect(html).toContain('Submit availability')
    expect(html).toContain('id="therapist-availability-workspace"')
    expect(html).toContain('Not submitted')
    expect(html).toContain('Cycle:')
    expect(html).toContain('42 days selected')
    expect(html).toContain('Tap a day to switch between Available, Need Off, and Request to Work.')
    expect(html).toContain('Mar')
    expect(html).toContain('Apr')
    expect(html).toContain('Request to Work')
    expect(html).toContain('Need Off')
    expect(html).toContain('request to work')
    expect(html).toContain('Week 1')
    expect(html).not.toContain('Must work')
    expect(html).not.toContain('Unavailable')
  })
})
