import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ManagerTriageDashboard } from '@/components/manager/ManagerTriageDashboard'

describe('ManagerTriageDashboard', () => {
  it('renders feature cards, schedule overview, and manager inbox sections', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: 15,
        todayCoverageTotal: 17,
        upcomingShiftCount: 12,
        upcomingShiftDays: [
          { label: 'Mar 26', count: 4 },
          { label: 'Mar 27', count: 5 },
        ],
        todayActiveShifts: [
          { label: 'Adrienne S.', detail: 'Day shift | Lead' },
          { label: 'Alyce L.', detail: 'Day shift | Staff' },
        ],
        recentActivity: [
          { title: 'Brianna approved a shift swap', timeLabel: '2 hours ago', href: '/requests' },
        ],
        pendingRequests: 5,
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
      })
    )

    expect(html).toContain('Dashboard')
    expect(html).toContain('Today&#x27;s Coverage')
    expect(html).toContain('15 of 17 shifts')
    expect(html).toContain('Upcoming Shifts')
    expect(html).toContain('Mar 26: 4 shifts')
    expect(html).toContain('Pending Requests')
    expect(html).toContain('5 pending requests')
    expect(html).toContain('Schedule Overview')
    expect(html).toContain('Today&#x27;s Active Shifts')
    expect(html).toContain('Adrienne S.')
    expect(html).toContain('Manager Inbox')
    expect(html).toContain('Recent Activity')
    expect(html).toContain('Brianna approved a shift swap')
    expect(html).toContain('Publish by Apr 27')
  })

  it('renders loading state placeholders and action links', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: '--',
        todayCoverageTotal: '--',
        upcomingShiftCount: '--',
        upcomingShiftDays: [],
        todayActiveShifts: [],
        recentActivity: [],
        pendingRequests: '--',
        approvalsWaiting: '--',
        currentCycleStatus: 'Loading',
        currentCycleDetail: 'Loading',
        nextCycleLabel: 'Loading',
        nextCycleDetail: 'Loading',
        needsReviewCount: '--',
        needsReviewDetail: 'Loading',
        approvalsHref: '/approvals',
        scheduleHref: '/coverage?view=week',
        reviewHref: '/approvals',
      })
    )

    expect(html).toContain('Loading...')
    expect(html).toContain('Review all')
    expect(html).toContain('Open schedule')
    expect(html).toContain('href="/approvals"')
    expect(html).toContain('href="/coverage?view=week"')
  })
})
