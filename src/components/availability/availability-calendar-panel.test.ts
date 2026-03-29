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
        selectedDates: ['2026-03-24'],
        statusByDate: {
          '2026-03-24': 'selected',
        },
        onPreviousMonth: () => {},
        onNextMonth: () => {},
        onToggleDate: () => {},
      })
    )

    expect(html).toContain('March 2026')
    expect(html).toContain('aria-label="Previous month"')
    expect(html).toContain('aria-label="Next month"')
    expect(html).toContain('Su')
    expect(html).toContain('Sa')
    expect(html).toContain('data-selected="true"')
    expect(html).toContain('data-in-cycle="false"')
  })
})
