import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TherapistAvailabilityWorkspace } from '@/components/availability/TherapistAvailabilityWorkspace'

describe('TherapistAvailabilityWorkspace', () => {
  it('renders therapist-only controls, calendar, and personal status content', () => {
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
            requestedBy: 'Barbara C.',
            cycleLabel: 'Apr 2026 (2026-03-22 to 2026-05-02)',
            entryType: 'force_off',
            shiftType: 'both',
            canDelete: true,
          },
        ],
        initialCycleId: 'cycle-1',
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('My Availability')
    expect(html).toContain('id="therapist-availability-workspace"')
    expect(html).toContain('Tap a day to cycle through statuses')
    expect(html).toContain('Must work')
    expect(html).toContain('Unavailable')
    expect(html).toContain('no preference')
    expect(html).toContain('Week 1')
    expect(html).toContain('Submit')
    expect(html).not.toContain('Therapist')
    expect(html).not.toContain('Not submitted yet')
  })
})
