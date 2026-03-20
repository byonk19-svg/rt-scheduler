import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'

describe('ManagerWorkspaceHeader', () => {
  it('renders an editorial manager header with summary content and actions', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerWorkspaceHeader, {
        title: 'Coverage',
        subtitle: 'Mar 22-May 2 - 6 weeks - Click a day to edit',
        summary: createElement('div', null, 'Summary copy'),
        actions: createElement('div', null, 'Actions'),
      })
    )

    expect(html).toContain('Coverage')
    expect(html).toContain('Summary copy')
    expect(html).toContain('Actions')
    expect(html).toContain('border-b border-border/70 bg-card/80')
  })
})
