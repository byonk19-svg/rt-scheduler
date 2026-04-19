import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ManagerTriageDashboard } from '@/components/manager/ManagerTriageDashboard'

describe('ManagerTriageDashboard', () => {
  it('renders feature cards, inbox sections, and the schedule-home entry point', () => {
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
        needsReviewCount: 2,
        needsReviewDetail: 'Preliminary request waiting',
        dayShiftsFilled: 18,
        dayShiftsTotal: 21,
        nightShiftsFilled: 15,
        nightShiftsTotal: 21,
        approvalsHref: '/approvals',
        scheduleHomeHref: '/dashboard/manager/schedule',
        scheduleHref: '/coverage?view=week',
        reviewHref: '/approvals',
        activeCycleDateRange: 'Mar 17 â€“ Apr 13',
      })
    )

    expect(html).toContain('>Inbox</h1>')
    expect(html).not.toContain('Manager Dashboard')
    expect(html).toContain('Coverage Issues')
    expect(html).toContain('Pending Approvals')
    expect(html).toContain('Upcoming Shifts')
    expect(html).toContain('Adrienne S.')
    expect(html).toContain('Manager Inbox')
    expect(html).toContain('Recent Activity')
    expect(html).toContain('Brianna approved a shift swap')
    expect(html).toContain('Open schedule home')
    expect(html).not.toContain('Current cycle')
    expect(html).not.toContain('Next 6-week cycle')
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
        needsReviewCount: '--',
        needsReviewDetail: 'Loading',
        dayShiftsFilled: '--',
        dayShiftsTotal: '--',
        nightShiftsFilled: '--',
        nightShiftsTotal: '--',
        approvalsHref: '/approvals',
        scheduleHomeHref: '/dashboard/manager/schedule',
        scheduleHref: '/coverage?view=week',
        reviewHref: '/approvals',
        activeCycleDateRange: undefined,
      })
    )

    expect(html).toContain('Loading...')
    expect(html).toContain('border-dashed')
    expect(html).toContain('Review updates')
    expect(html).toContain('Coverage Issues')
    expect(html).toContain('href="/approvals"')
    expect(html).toContain('href="/coverage?view=week"')
    expect(html).toContain('href="/dashboard/manager/schedule"')
  })

  it('shows actionable prompts when loaded metrics are empty', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: 0,
        todayCoverageTotal: 0,
        upcomingShiftCount: 0,
        upcomingShiftDays: [],
        todayActiveShifts: [],
        recentActivity: [],
        pendingRequests: 0,
        approvalsWaiting: 0,
        needsReviewCount: 0,
        needsReviewDetail: 'You are caught up.',
        dayShiftsFilled: 0,
        dayShiftsTotal: 0,
        nightShiftsFilled: 0,
        nightShiftsTotal: 0,
        approvalsHref: '/approvals',
        scheduleHomeHref: '/dashboard/manager/schedule',
        scheduleHref: '/coverage?view=week',
        reviewHref: '/approvals',
        activeCycleDateRange: 'Mar 17 â€“ Apr 13',
      })
    )

    expect(html).toContain('No draft started yet')
    expect(html).toContain('Open schedule to auto-draft')
    expect(html).toContain('Open coverage review')
    expect(html).toContain('Open schedule activity')
    expect(html).toContain('See the full schedule')
    expect(html).toContain('Open schedule home')
  })

  it('renders Schedule Completion before Recent Activity', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: 15,
        todayCoverageTotal: 17,
        upcomingShiftCount: 12,
        upcomingShiftDays: [],
        todayActiveShifts: [],
        recentActivity: [{ title: 'Some activity', timeLabel: '1 hour ago', href: '/coverage' }],
        pendingRequests: 0,
        approvalsWaiting: 0,
        needsReviewCount: 0,
        needsReviewDetail: 'You are caught up.',
        dayShiftsFilled: 18,
        dayShiftsTotal: 21,
        nightShiftsFilled: 15,
        nightShiftsTotal: 21,
        approvalsHref: '/approvals',
        scheduleHomeHref: '/dashboard/manager/schedule',
        scheduleHref: '/coverage?view=week',
        reviewHref: '/approvals',
        activeCycleDateRange: 'Mar 17 â€“ Apr 13',
      })
    )

    const scheduleProgressIndex = html.indexOf('Schedule Completion')
    const recentActivityIndex = html.indexOf('Recent Activity')

    expect(scheduleProgressIndex).toBeGreaterThan(-1)
    expect(recentActivityIndex).toBeGreaterThan(-1)
    expect(scheduleProgressIndex).toBeLessThan(recentActivityIndex)
  })

  it('renders cycle date range pill when provided', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: 15,
        todayCoverageTotal: 17,
        upcomingShiftCount: 12,
        upcomingShiftDays: [],
        todayActiveShifts: [],
        recentActivity: [],
        pendingRequests: 0,
        approvalsWaiting: 0,
        needsReviewCount: 0,
        needsReviewDetail: 'You are caught up.',
        dayShiftsFilled: 18,
        dayShiftsTotal: 21,
        nightShiftsFilled: 15,
        nightShiftsTotal: 21,
        approvalsHref: '/approvals',
        scheduleHomeHref: '/dashboard/manager/schedule',
        scheduleHref: '/coverage',
        reviewHref: '/approvals',
        activeCycleDateRange: 'Mar 17 â€“ Apr 13',
      })
    )

    expect(html).toContain('Mar 17 â€“ Apr 13')
  })
})
