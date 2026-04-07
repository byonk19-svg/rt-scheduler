import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvailabilityOverviewHeader } from '@/components/availability/AvailabilityOverviewHeader'

describe('AvailabilityOverviewHeader', () => {
  it('keeps the manager header clean and planning-led', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityOverviewHeader, {
        canManageAvailability: true,
        title: 'Availability And Staffing Inputs',
        subtitle: 'Mar 22-May 2 · 2026-03-22 to 2026-05-02',
        totalRequests: 18,
        needOffRequests: 7,
        availableToWorkRequests: 11,
        responseRatio: '9/24',
        actions: createElement('div', null, 'Actions'),
      })
    )

    expect(html).toContain('18 requests on file')
    expect(html).toContain('7 need off')
    expect(html).toContain('11 request to work')
    expect(html).not.toContain('9/24 responded')
  })
})
