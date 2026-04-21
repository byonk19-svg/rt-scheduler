import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvailabilitySecondaryPanel } from '@/components/availability/availability-secondary-panel'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/availability/availability-secondary-panel.tsx'),
  'utf8'
)
const headerSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/AvailabilitySecondaryHeader.tsx'),
  'utf8'
)

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

  it('keeps collapsed and expanded secondary-workspace chrome in a dedicated header component', () => {
    expect(source).toContain('AvailabilitySecondaryHeader')
    expect(headerSource).toContain('Show response roster and inbox')
    expect(headerSource).toContain('Hide secondary workspace')
  })
})
