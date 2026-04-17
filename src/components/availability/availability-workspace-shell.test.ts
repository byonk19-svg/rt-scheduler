import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  AvailabilityWorkspaceShell,
  type AvailabilityWorkspaceShellProps,
} from '@/components/availability/availability-workspace-shell'

describe('AvailabilityWorkspaceShell', () => {
  it('renders a three-column workbench with compact secondary panels underneath', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityWorkspaceShell, {
        primaryHeader: createElement('div', undefined, 'Primary header'),
        controls: createElement('div', undefined, 'Controls'),
        calendar: createElement('div', undefined, 'Calendar'),
        context: createElement('div', undefined, 'Context'),
        secondaryContent: createElement('div', undefined, 'Secondary content'),
      } satisfies AvailabilityWorkspaceShellProps)
    )

    expect(html).toContain('Primary header')
    expect(html).toContain('Controls')
    expect(html).toContain('Calendar')
    expect(html).toContain('Context')
    expect(html).toContain('Secondary content')
    expect(html).toContain('data-slot="availability-workspace-primary"')
    expect(html).toContain('data-slot="availability-workspace-context"')
    expect(html).toContain('data-slot="availability-workspace-secondary"')
  })
})
