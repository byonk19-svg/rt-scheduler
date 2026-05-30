import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { ManagerToolAccessDenied } from '@/components/auth/ManagerToolAccessDenied'

describe('ManagerToolAccessDenied', () => {
  it('explains authenticated manager-tool denials without looking like a broken redirect', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerToolAccessDenied, { toolName: 'Analytics' })
    )

    expect(html).toContain('Manager access required')
    expect(html).toContain('You do not have access to this manager tool.')
    expect(html).toContain('Analytics is restricted to active managers.')
    expect(html).toContain('Open staff dashboard')
    expect(html).toContain('View my schedule')
  })
})
