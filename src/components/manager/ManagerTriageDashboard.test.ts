import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ManagerTriageDashboard } from '@/components/manager/ManagerTriageDashboard'

const baseProps = {
  todayCoverageCovered: 15,
  todayCoverageTotal: 17,
  upcomingShiftCount: 6,
  upcomingShiftDays: [
    { label: 'Mar 26', count: 4 },
    { label: 'Mar 27', count: 2 },
  ],
  todayStaffedShifts: [
    { label: 'Adrienne S.', detail: 'Day shift | Lead' },
    { label: 'Alyce L.', detail: 'Day shift | Staff' },
    { label: 'Brianna K.', detail: 'Day shift | Staff' },
    { label: 'Barbara J.', detail: 'Night shift | Lead' },
    { label: 'Unassigned therapist', detail: 'Night shift | Staff' },
  ],
  recentActivity: [
    { title: 'Brianna approved a shift swap', timeLabel: '2 hours ago', href: '/requests' },
  ],
  pendingRequests: 5,
  approvalsWaiting: 5,
  currentCycleStatus: 'Draft Schedule Block',
  currentCycleDetail: 'Publish by Apr 27',
  nextCycleLabel: 'Collect availability Mar 17',
  nextCycleDetail: 'Publish by Apr 27',
  needsReviewCount: 2,
  needsReviewDetail: 'Preliminary request waiting',
  dayShiftsFilled: 18,
  dayShiftsTotal: 21,
  nightShiftsFilled: 15,
  nightShiftsTotal: 21,
  approvalsHref: '/approvals',
  lotteryHref: '/lottery',
  scheduleHref: '/schedule',
  reviewHref: '/approvals',
  activeCycleDateRange: 'Mar 17 - Apr 13',
  nextCycleCtaHref: '/schedule/planning?cycle=next-cycle',
}

describe('ManagerTriageDashboard', () => {
  it('renders a focused triage hierarchy with schedule context first', () => {
    const html = renderToStaticMarkup(createElement(ManagerTriageDashboard, baseProps))

    expect(html).toContain('>Manager Dashboard</h1>')
    expect(html).toContain('What needs to be fixed or approved right now.')
    expect(html).toContain('Facility')
    expect(html).toContain('Riverside Medical Center')
    expect(html).toContain('Current Schedule Block')
    expect(html).toContain('Mar 17 - Apr 13')
    expect(html).toContain('Shift context')
    expect(html).toContain('Day / Night / Both')
    expect(html).toContain('Schedule status')
    expect(html).toContain('Draft Schedule Block')

    const attentionIndex = html.indexOf('Needs your attention')
    const staffingIndex = html.indexOf('Today&#x27;s staffing')
    const nextDeadlineIndex = html.indexOf('Next deadline')

    expect(attentionIndex).toBeGreaterThan(-1)
    expect(staffingIndex).toBeGreaterThan(-1)
    expect(nextDeadlineIndex).toBeGreaterThan(-1)
    expect(attentionIndex).toBeLessThan(staffingIndex)
    expect(staffingIndex).toBeLessThan(nextDeadlineIndex)
  })

  it('replaces separate KPI cards with attention rows and primary actions', () => {
    const html = renderToStaticMarkup(createElement(ManagerTriageDashboard, baseProps))

    expect(html).toContain('5 approvals waiting')
    expect(html).toContain('Review requests')
    expect(html).toContain('9 open shifts in this Schedule Block')
    expect(html).toContain('Fill open shifts')
    expect(html).toContain('2 coverage safety issues')
    expect(html).toContain('View schedule')
    expect(html).toContain('2 review items waiting')
    expect(html).toContain('Review updates')
    expect(html).toContain('href="/approvals"')
    expect(html).toContain('href="/schedule"')
    expect(html).not.toContain('Coverage Issues')
    expect(html).not.toContain('Pending Approvals')
    expect(html).not.toContain('Upcoming Shifts')
    expect(html).not.toContain('Open Assignments')
  })

  it('shows day and night staffing with lead, workers, open count, and status', () => {
    const html = renderToStaticMarkup(createElement(ManagerTriageDashboard, baseProps))

    expect(html).toContain('Day shift')
    expect(html).toContain('Lead: ')
    expect(html).toContain('Adrienne S.')
    expect(html).toContain('Alyce L., Brianna K.')
    expect(html).toContain('Night shift')
    expect(html).toContain('Barbara J.')
    expect(html).toContain('Open: ')
    expect(html).toContain('Needs attention')
    expect(html).toContain('Good')
    expect(html).not.toContain('Today / This week')
  })

  it('renders the compact current Schedule Block card instead of the old workflow card', () => {
    const html = renderToStaticMarkup(createElement(ManagerTriageDashboard, baseProps))

    expect(html).toContain('Next deadline')
    expect(html).toContain('Availability')
    expect(html).toContain('Build')
    expect(html).toContain('Review')
    expect(html).toContain('Publish')
    expect(html).toContain('Continue Schedule Block')
    expect(html).toContain('Plan next Schedule Block')
    expect(html).toContain('href="/schedule/planning?cycle=next-cycle"')
    expect(html).not.toContain('Scheduling workflow')
    expect(html).not.toContain('Follow these steps each Schedule Block')
    expect(html).not.toContain('Prepare availability')
  })

  it('hides low-value empty sections and avoids duplicated metrics', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        ...baseProps,
        todayCoverageCovered: 0,
        todayCoverageTotal: 0,
        upcomingShiftCount: 0,
        upcomingShiftDays: [],
        todayStaffedShifts: [],
        recentActivity: [],
        pendingRequests: 0,
        approvalsWaiting: 0,
        needsReviewCount: 0,
        needsReviewDetail: 'You are caught up.',
        dayShiftsFilled: 0,
        dayShiftsTotal: 0,
        nightShiftsFilled: 0,
        nightShiftsTotal: 0,
        currentCycleStatus: 'Published',
      })
    )

    expect(html).toContain('0 coverage safety issues')
    expect(html).not.toContain('Recent activity')
    expect(html).not.toContain('Upcoming exceptions')
    expect(html).not.toContain('Open shifts snapshot')
    expect(html).not.toContain('Open Lottery')
    expect(html).not.toContain('Upcoming Shifts')
  })

  it('lists only actionable upcoming exceptions and preserves workflow links', () => {
    const html = renderToStaticMarkup(createElement(ManagerTriageDashboard, baseProps))

    expect(html).toContain('Upcoming exceptions')
    expect(html).toContain('Mar 26')
    expect(html).toContain('4 open shifts')
    expect(html).toContain('Requests queue')
    expect(html).toContain('5 approvals affecting schedule changes')
    expect(html).toContain('Open Lottery')
    expect(html).toContain('href="/lottery"')
    expect(html.match(/href="\/lottery"/g)).toHaveLength(1)
  })

  it('keeps recent activity conditional and navigable when activity exists', () => {
    const html = renderToStaticMarkup(createElement(ManagerTriageDashboard, baseProps))

    expect(html).toContain('Recent activity')
    expect(html).toContain('Brianna approved a shift swap')
    expect(html).toContain('href="/requests"')
    expect(html).toContain('href="/notifications"')
  })

  it('renders loading state placeholders and safe action links', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        ...baseProps,
        todayCoverageCovered: '--',
        todayCoverageTotal: '--',
        upcomingShiftCount: '--',
        upcomingShiftDays: [],
        todayStaffedShifts: [],
        recentActivity: [],
        pendingRequests: '--',
        approvalsWaiting: '--',
        needsReviewCount: '--',
        dayShiftsFilled: '--',
        dayShiftsTotal: '--',
        nightShiftsFilled: '--',
        nightShiftsTotal: '--',
        currentCycleStatus: 'Loading',
        currentCycleDetail: 'Loading',
        nextCycleLabel: 'Loading',
        nextCycleDetail: 'Loading',
      })
    )

    expect(html).toContain('Loading...')
    expect(html).toContain('Review requests')
    expect(html).toContain('href="/approvals"')
    expect(html).toContain('href="/schedule"')
  })
})
