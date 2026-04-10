import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvailabilityWorkspaceShell } from '@/components/availability/availability-workspace-shell'

describe('AvailabilityWorkspaceShell', () => {
  it('renders a combined primary workspace, a right-side aside, and a lower content region', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityWorkspaceShell, {
        primaryHeader: createElement('div', undefined, 'Primary header'),
        controls: createElement('div', undefined, 'Controls'),
        calendar: createElement('div', undefined, 'Calendar'),
        aside: createElement('div', undefined, 'Aside'),
        lower: createElement('div', undefined, 'Lower'),
      })
    )

    expect(html).toContain('Primary header')
    expect(html).toContain('Controls')
    expect(html).toContain('Calendar')
    expect(html).toContain('Aside')
    expect(html).toContain('Lower')
    expect(html).toContain('data-slot="availability-workspace-primary"')
    expect(html).toContain('data-slot="availability-workspace-aside"')
    expect(html).toContain('data-slot="availability-workspace-lower"')
  })

  it('places trailing content beside the roster column on wide layouts when provided', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityWorkspaceShell, {
        controls: createElement('div', undefined, 'Controls'),
        calendar: createElement('div', undefined, 'Calendar'),
        aside: createElement('div', undefined, 'Aside'),
        lower: createElement('div', undefined, 'Lower'),
        trailing: createElement('div', undefined, 'Review panel'),
      })
    )

    expect(html).toContain('data-slot="availability-workspace-split"')
    expect(html).toContain('Review panel')
  })
})
