import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvailabilityCalendarPanel } from '@/components/availability/availability-calendar-panel'

describe('AvailabilityCalendarPanel', () => {
  it('renders the full Schedule Block grid with request and planner indicators', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityCalendarPanel, {
        cycleStart: '2026-03-22',
        cycleEnd: '2026-05-02',
        dayStates: {
          '2026-03-24': { draftSelection: 'need_off' },
          '2026-03-26': { savedPlanner: 'cannot_work' },
          '2026-03-27': { requestTypes: ['request_to_work'] },
        },
        onToggleDate: () => {},
      })
    )

    expect(html).toContain('Unmarked days are baseline')
    expect(html).toContain('Mar 22')
    expect(html).toContain('Planning assumption')
    expect(html).toContain('Need off')
    expect(html).toContain('Therapist request')
    expect(html).toContain('Sun')
    expect(html).toContain('Sat')
    expect(html).toContain('data-status="need_off"')
    expect(html).toContain('data-in-cycle="true"')
    expect(html).not.toContain('overflow-x-auto')
  })
})
