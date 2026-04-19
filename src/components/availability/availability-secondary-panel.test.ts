import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvailabilitySecondaryPanel } from '@/components/availability/availability-secondary-panel'

describe('AvailabilitySecondaryPanel', () => {
  it('starts collapsed behind a single reveal action', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilitySecondaryPanel, {
        defaultTab: 'roster',
        submittedCount: 9,
        awaitingCount: 15,
        requestCount: 12,
        roster: createElement('div', null, 'Roster content'),
        inbox: createElement('div', null, 'Inbox content'),
      })
    )

    expect(html).toContain('Show response roster and inbox')
    expect(html).toContain('15 awaiting')
    expect(html).toContain('9 submitted')
    expect(html).toContain('12 requests')
    expect(html).not.toContain('role="tablist"')
    expect(html).not.toContain('Roster content')
    expect(html).not.toContain('Inbox content')
  })

  it('can render expanded when a filtered deep link opens the inbox by default', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilitySecondaryPanel, {
        defaultOpen: true,
        defaultTab: 'inbox',
        submittedCount: 9,
        awaitingCount: 15,
        requestCount: 12,
        roster: createElement('div', null, 'Roster content'),
        inbox: createElement('div', null, 'Inbox content'),
      })
    )

    expect(html).toContain('role="tablist"')
    expect(html).toContain('Inbox content')
    expect(html).not.toContain('Roster content')
  })
})
