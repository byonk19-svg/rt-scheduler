import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ManagerTriageDashboard } from '@/components/manager/ManagerTriageDashboard'

describe('ManagerTriageDashboard', () => {
  it('renders feature cards, schedule overview, and a clear next-action hierarchy', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: 15,
        todayCoverageTotal: 17,
        upcomingShiftCount: 12,
        upcomingShiftDays: [
          { label: 'Mar 26', count: 4 },
          { label: 'Mar 27', count: 5 },
        ],
        todayStaffedShifts: [
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
        dayShiftsFilled: 18,
        dayShiftsTotal: 21,
        nightShiftsFilled: 15,
        nightShiftsTotal: 21,
        approvalsHref: '/approvals',
        lotteryHref: '/lottery',
        scheduleHref: '/coverage?view=week',
        reviewHref: '/approvals',
        activeCycleDateRange: 'Mar 17 – Apr 13',
      })
    )

    expect(html).toContain('>Manager Dashboard</h1>')
    expect(html).not.toContain('>Inbox</h1>')
    expect(html).toContain('Good morning')
    expect(html).toContain('Riverside Medical Center')
    expect(html).toContain('Scheduling workflow')
    expect(html).toContain('Your next urgent action')
    expect(html).toContain('Prepare availability')
    expect(html).toContain('Build schedule')
    expect(html).toContain('Review changes')
    expect(html).toContain('Publish schedule')
    expect(html).toContain('Coverage Issues')
    expect(html).toContain('Pending Approvals')
    expect(html).toContain('Upcoming Shifts')
    expect(html).toContain('Open Assignments')
    expect(html).toContain('2 updates need review')
    expect(html).toContain('Review updates')
    expect(html).toContain('Today / This week')
    expect(html).toContain('Open shifts snapshot')
    expect(html).not.toContain('Publish flow')
    expect(html).toContain('Mar 26')
    expect(html).toContain('4 shifts')
    expect(html).toContain('Adrienne S.')
    expect(html).toContain('staffed shifts')
    expect(html).toContain('Staffed')
    expect(html).not.toContain('Coverage Risks')
    expect(html).toContain('Recent activity')
    expect(html).toContain('Brianna approved a shift swap')
    expect(html).toContain('href="/requests"')
    expect(html).toContain('Publish by Apr 27')

    const nextActionIndex = html.indexOf('Your next urgent action')
    const metricCardIndex = html.indexOf('Coverage Issues')

    expect(nextActionIndex).toBeGreaterThan(-1)
    expect(metricCardIndex).toBeGreaterThan(-1)
    expect(nextActionIndex).toBeLessThan(metricCardIndex)
  })

  it('renders loading state placeholders and action links', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: '--',
        todayCoverageTotal: '--',
        upcomingShiftCount: '--',
        upcomingShiftDays: [],
        todayStaffedShifts: [],
        recentActivity: [],
        pendingRequests: '--',
        approvalsWaiting: '--',
        currentCycleStatus: 'Loading',
        currentCycleDetail: 'Loading',
        nextCycleLabel: 'Loading',
        nextCycleDetail: 'Loading',
        needsReviewCount: '--',
        needsReviewDetail: 'Loading',
        dayShiftsFilled: '--',
        dayShiftsTotal: '--',
        nightShiftsFilled: '--',
        nightShiftsTotal: '--',
        approvalsHref: '/approvals',
        lotteryHref: '/lottery',
        scheduleHref: '/coverage?view=week',
        reviewHref: '/approvals',
        activeCycleDateRange: undefined,
      })
    )

    expect(html).toContain('Loading...')
    expect(html).toContain('border-dashed')
    expect(html).toContain('Open schedule')
    expect(html).toContain('Coverage Issues')
    expect(html).toContain('href="/approvals"')
    expect(html).toContain('href="/coverage?view=week"')
    expect(html).toContain('Open Assignments')
    expect(html).toContain('Open Lottery')
    expect(html).toContain('href="/lottery"')
  })

  it('shows actionable prompts when loaded metrics are empty', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: 0,
        todayCoverageTotal: 0,
        upcomingShiftCount: 0,
        upcomingShiftDays: [],
        todayStaffedShifts: [],
        recentActivity: [],
        pendingRequests: 0,
        approvalsWaiting: 0,
        currentCycleStatus: 'Draft cycle',
        currentCycleDetail: 'Publish by Apr 27',
        nextCycleLabel: 'Collect availability Mar 17',
        nextCycleDetail: 'Publish by Apr 27',
        needsReviewCount: 0,
        needsReviewDetail: 'You are caught up.',
        dayShiftsFilled: 0,
        dayShiftsTotal: 0,
        nightShiftsFilled: 0,
        nightShiftsTotal: 0,
        approvalsHref: '/approvals',
        lotteryHref: '/lottery',
        scheduleHref: '/coverage?view=week',
        reviewHref: '/approvals',
        activeCycleDateRange: 'Mar 17 – Apr 13',
      })
    )

    expect(html).not.toContain('Publish Readiness')
    expect(html).toContain('No urgent issues right now')
    expect(html).toContain('Not started')
  })

  it('renders scheduling workflow before recent activity', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: 15,
        todayCoverageTotal: 17,
        upcomingShiftCount: 12,
        upcomingShiftDays: [],
        todayStaffedShifts: [],
        recentActivity: [{ title: 'Some activity', timeLabel: '1 hour ago', href: '/coverage' }],
        pendingRequests: 0,
        approvalsWaiting: 0,
        currentCycleStatus: 'Draft cycle',
        currentCycleDetail: 'Publish by Apr 27',
        nextCycleLabel: 'Collect availability Apr 1',
        nextCycleDetail: 'Publish by Apr 27',
        needsReviewCount: 0,
        needsReviewDetail: 'You are caught up.',
        dayShiftsFilled: 18,
        dayShiftsTotal: 21,
        nightShiftsFilled: 15,
        nightShiftsTotal: 21,
        approvalsHref: '/approvals',
        lotteryHref: '/lottery',
        scheduleHref: '/coverage?view=week',
        reviewHref: '/approvals',
        activeCycleDateRange: 'Mar 17 – Apr 13',
      })
    )

    const scheduleProgressIndex = html.indexOf('Scheduling workflow')
    const recentActivityIndex = html.indexOf('Recent activity')

    expect(scheduleProgressIndex).toBeGreaterThan(-1)
    expect(recentActivityIndex).toBeGreaterThan(-1)
    expect(scheduleProgressIndex).toBeLessThan(recentActivityIndex)
  })

  it('renders the canonical Lottery link in the open shifts snapshot', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: 15,
        todayCoverageTotal: 17,
        upcomingShiftCount: 12,
        upcomingShiftDays: [],
        todayStaffedShifts: [],
        recentActivity: [{ title: 'Some activity', timeLabel: '1 hour ago', href: '/coverage' }],
        pendingRequests: 0,
        approvalsWaiting: 0,
        currentCycleStatus: 'Draft cycle',
        currentCycleDetail: 'Publish by Apr 27',
        nextCycleLabel: 'Collect availability Apr 1',
        nextCycleDetail: 'Publish by Apr 27',
        needsReviewCount: 0,
        needsReviewDetail: 'You are caught up.',
        dayShiftsFilled: 18,
        dayShiftsTotal: 21,
        nightShiftsFilled: 15,
        nightShiftsTotal: 21,
        approvalsHref: '/approvals',
        lotteryHref: '/lottery',
        scheduleHref: '/coverage?view=week',
        reviewHref: '/approvals',
        activeCycleDateRange: 'Mar 17 â€“ Apr 13',
      })
    )

    const openShiftsIndex = html.indexOf('Open shifts snapshot')
    const lotteryIndex = html.indexOf('Open Lottery')

    expect(openShiftsIndex).toBeGreaterThan(-1)
    expect(lotteryIndex).toBeGreaterThan(-1)
    expect(html).toContain('Open Lottery')
    expect(html).toContain('href="/lottery"')
    expect(html.match(/href="\/lottery"/g)).toHaveLength(1)
    expect(openShiftsIndex).toBeLessThan(lotteryIndex)
  })

  it('renders recent activity items as navigable links using the provided href', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: 15,
        todayCoverageTotal: 17,
        upcomingShiftCount: 12,
        upcomingShiftDays: [],
        todayStaffedShifts: [],
        recentActivity: [
          { title: 'Schedule published', timeLabel: '5 minutes ago', href: '/coverage?view=week' },
          { title: 'New preliminary request', timeLabel: '1 hour ago', href: '/approvals' },
        ],
        pendingRequests: 0,
        approvalsWaiting: 0,
        currentCycleStatus: 'Published',
        currentCycleDetail: 'Live',
        nextCycleLabel: 'Collect availability Apr 1',
        nextCycleDetail: 'Publish by May 11',
        needsReviewCount: 0,
        needsReviewDetail: 'You are caught up.',
        dayShiftsFilled: 18,
        dayShiftsTotal: 21,
        nightShiftsFilled: 15,
        nightShiftsTotal: 21,
        approvalsHref: '/approvals',
        lotteryHref: '/lottery',
        scheduleHref: '/coverage',
        reviewHref: '/approvals',
        activeCycleDateRange: 'Mar 17 – Apr 13',
      })
    )

    expect(html).toContain('Schedule published')
    expect(html).toContain('href="/coverage?view=week"')
    expect(html).toContain('New preliminary request')
    expect(html).toContain('href="/approvals"')
  })

  it('renders cycle date range pill when provided', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: 15,
        todayCoverageTotal: 17,
        upcomingShiftCount: 12,
        upcomingShiftDays: [],
        todayStaffedShifts: [],
        recentActivity: [],
        pendingRequests: 0,
        approvalsWaiting: 0,
        currentCycleStatus: 'Published',
        currentCycleDetail: 'Live',
        nextCycleLabel: 'Collect availability Apr 1',
        nextCycleDetail: 'Publish by May 11',
        needsReviewCount: 0,
        needsReviewDetail: 'You are caught up.',
        dayShiftsFilled: 18,
        dayShiftsTotal: 21,
        nightShiftsFilled: 15,
        nightShiftsTotal: 21,
        approvalsHref: '/approvals',
        lotteryHref: '/lottery',
        scheduleHref: '/coverage',
        reviewHref: '/approvals',
        activeCycleDateRange: 'Mar 17 – Apr 13',
      })
    )

    expect(html).toContain('Mar 17 – Apr 13')
  })
  it('renders an always-visible Lottery link with the canonical workflow link', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: 15,
        todayCoverageTotal: 17,
        upcomingShiftCount: 12,
        upcomingShiftDays: [],
        todayStaffedShifts: [],
        recentActivity: [],
        pendingRequests: 0,
        approvalsWaiting: 0,
        currentCycleStatus: 'Published',
        currentCycleDetail: 'Live',
        nextCycleLabel: 'Collect availability Apr 1',
        nextCycleDetail: 'Publish by May 11',
        needsReviewCount: 0,
        needsReviewDetail: 'You are caught up.',
        dayShiftsFilled: 18,
        dayShiftsTotal: 21,
        nightShiftsFilled: 15,
        nightShiftsTotal: 21,
        approvalsHref: '/approvals',
        lotteryHref: '/lottery',
        scheduleHref: '/coverage',
        reviewHref: '/approvals',
        activeCycleDateRange: 'Mar 17 â€“ Apr 13',
      })
    )

    expect(html).toContain('Open shifts snapshot')
    expect(html).toContain('Open Lottery')
    expect(html).toContain('href="/lottery"')
  })
})
