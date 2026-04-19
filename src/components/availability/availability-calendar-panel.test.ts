import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvailabilityCalendarPanel } from '@/components/availability/availability-calendar-panel'

describe('AvailabilityCalendarPanel', () => {
  it('renders month navigation, weekday headings, and selected saved dates', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityCalendarPanel, {
        monthStart: '2026-03-01',
        cycleStart: '2026-03-22',
        cycleEnd: '2026-05-02',
        selectedTherapistName: 'Barbara C.',
        cycleLabel: 'Mar 22 - May 2, 2026',
        dayStates: {
          '2026-03-24': { draftSelection: 'will_work' },
          '2026-03-26': {
            savedPlanner: 'cannot_work',
            savedPlannerKind: 'weekly_default',
            savedPlannerBadge: 'Never',
          },
          '2026-03-27': { requestTypes: ['need_off'] },
        },
        onPreviousMonth: () => {},
        onNextMonth: () => {},
        onToggleDate: () => {},
      })
    )

    expect(html).toContain('March 2026')
    expect(html).toContain('Selected therapist')
    expect(html).toContain('Current cycle')
    expect(html).toContain('Saved plan')
    expect(html).toContain('Weekly default')
    expect(html).toContain('Need off request')
    expect(html).toContain('Never')
    expect(html).toContain('data-saved-kind="weekly_default"')
    expect(html).toContain('aria-label="Previous month"')
    expect(html).toContain('aria-label="Next month"')
    expect(html).toContain('Su')
    expect(html).toContain('Sa')
    expect(html).toContain('data-status="will_work"')
    expect(html).toContain('data-in-cycle="false"')
  })
})
