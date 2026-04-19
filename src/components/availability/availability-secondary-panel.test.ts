import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvailabilitySecondaryPanel } from '@/components/availability/availability-secondary-panel'

describe('AvailabilitySecondaryPanel', () => {
  it('renders an accessible tablist and shows the default roster panel', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilitySecondaryPanel, {
        defaultTab: 'roster',
        roster: createElement('div', null, 'Roster content'),
        inbox: createElement('div', null, 'Inbox content'),
      })
    )

    expect(html).toContain('role="tablist"')
    expect(html).toContain('role="tab"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('Roster content')
    expect(html).not.toContain('Inbox content')
  })

  it('shows the inbox panel when inbox is the default tab', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilitySecondaryPanel, {
        defaultTab: 'inbox',
        roster: createElement('div', null, 'Roster content'),
        inbox: createElement('div', null, 'Inbox content'),
      })
    )

    expect(html).toContain('Inbox content')
    expect(html).not.toContain('Roster content')
  })
})
