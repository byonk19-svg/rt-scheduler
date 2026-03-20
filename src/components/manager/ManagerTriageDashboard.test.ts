import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ManagerTriageDashboard } from '@/components/manager/ManagerTriageDashboard'

describe('ManagerTriageDashboard', () => {
  it('renders the manager inbox signals without reverting to a generic dashboard', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        approvalsWaiting: 3,
        currentCycleStatus: 'Draft cycle',
        currentCycleDetail: 'Publish by Apr 27',
        nextCycleLabel: 'Collect availability Mar 17',
        nextCycleDetail: 'Publish by Apr 27',
        needsReviewCount: 2,
        needsReviewDetail: 'Preliminary request waiting',
        approvalsHref: '/approvals',
        scheduleHref: '/coverage?view=week',
        reviewHref: '/approvals',
        onNavigate: vi.fn(),
      })
    )

    expect(html).toContain('What needs attention now')
    expect(html).toContain('Pending approvals')
    expect(html).toContain('3 waiting')
    expect(html).toContain('Current cycle')
    expect(html).toContain('Publish by Apr 27')
    expect(html).toContain('Next 6-week cycle')
    expect(html).toContain('Collect availability Mar 17')
    expect(html).toContain('Needs review')
    expect(html).toContain('Preliminary request waiting')

    expect(html).not.toContain('Dashboard')
    expect(html).not.toContain('Next actions')
    expect(html).not.toContain('Coverage cleanup')
    expect(html).not.toContain('Availability follow-up')
    expect(html).toContain('Apr 27')
    expect(html).toContain('Draft cycle')
  })
})
