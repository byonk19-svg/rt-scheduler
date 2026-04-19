import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvailabilityOverviewHeader } from '@/components/availability/AvailabilityOverviewHeader'

describe('AvailabilityOverviewHeader', () => {
  it('keeps the manager header clean and planning-led', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityOverviewHeader, {
        title: 'Availability And Staffing Inputs',
        subtitle: 'Mar 22-May 2 · 2026-03-22 to 2026-05-02',
        totalRequests: 18,
        needOffRequests: 7,
        availableToWorkRequests: 11,
        responseRatio: null,
        actions: createElement('div', null, 'Actions'),
      })
    )

    expect(html).toContain('>18</span>')
    expect(html).toContain('requests on file')
    expect(html).toContain('7 need off')
    expect(html).toContain('11 request to work')
    expect(html).not.toContain('9/24 responded')
  })

  it('renders summary content overrides without falling back to generic request counts', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityOverviewHeader, {
        title: 'Availability Planning',
        subtitle: 'Mar 22-May 2',
        totalRequests: 18,
        needOffRequests: 7,
        availableToWorkRequests: 11,
        responseRatio: '9/24',
        summaryContent: createElement('div', null, 'Custom cycle summary'),
      })
    )

    expect(html).toContain('Custom cycle summary')
    expect(html).not.toContain('requests on file')
    expect(html).not.toContain('9/24 responded')
  })
})
