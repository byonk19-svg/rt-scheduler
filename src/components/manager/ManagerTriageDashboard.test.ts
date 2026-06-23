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
    {
      title: 'Brianna posted a trade request',
      detail: 'Mar 26 day shift for Mar 28 night shift. Needs manager review.',
      timeLabel: '2 hours ago',
      href: '/requests',
    },
  ],
  pendingRequests: 5,
  approvalsWaiting: 5,
  currentCycleStatus: 'Draft',
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
    expect(html).toContain('Schedule scope')
    expect(html).toContain('Current site')
    expect(html).toContain('Current Schedule Block')
    expect(html).toContain('Mar 17 - Apr 13')
    expect(html).toContain('Shift context')
    expect(html).toContain('Day / Night / Both')
    expect(html).toContain('Schedule status')
    expect(html).toContain('Draft')
    expect(html).toContain('Manager checklist')
    expect(html).toContain('Start with the first item that needs attention.')
    expect(html).toContain('Make today safe')
    expect(html).toContain('Clear manager decisions')
    expect(html).toContain('Fill the schedule')
    expect(html).toContain('Prepare the next block')

    const checklistIndex = html.indexOf('Manager checklist')
    const attentionIndex = html.indexOf('Needs your attention')
    const staffingIndex = html.indexOf('Today&#x27;s staffing')
    const nextDeadlineIndex = html.indexOf('Next deadline')

    expect(checklistIndex).toBeGreaterThan(-1)
    expect(attentionIndex).toBeGreaterThan(-1)
    expect(staffingIndex).toBeGreaterThan(-1)
    expect(nextDeadlineIndex).toBeGreaterThan(-1)
    expect(attentionIndex).toBeLessThan(checklistIndex)
    expect(checklistIndex).toBeLessThan(staffingIndex)
    expect(staffingIndex).toBeLessThan(nextDeadlineIndex)
  })

  it('replaces separate KPI cards with attention rows and primary actions', () => {
    const html = renderToStaticMarkup(createElement(ManagerTriageDashboard, baseProps))

    expect(html).toContain('Priority 1 - Top priority')
    expect(html).toContain('Priority 2')
    expect(html).toContain('Priority 3')
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

  it('promotes coverage safety issues above routine review items', () => {
    const html = renderToStaticMarkup(createElement(ManagerTriageDashboard, baseProps))

    const topPriorityIndex = html.indexOf('Top priority')
    const coverageIndex = html.indexOf('2 coverage safety issues')
    const reviewIndex = html.indexOf('2 review items waiting')

    expect(topPriorityIndex).toBeGreaterThan(-1)
    expect(coverageIndex).toBeGreaterThan(topPriorityIndex)
    expect(reviewIndex).toBeGreaterThan(coverageIndex)
    expect(html).toContain('href="/schedule"')
  })

  it('keeps checklist safety state aligned when today is staffed but missing a lead', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        ...baseProps,
        todayCoverageCovered: 17,
        todayCoverageTotal: 17,
        todayStaffedShifts: [
          { label: 'Adrienne S.', detail: 'Day shift | Lead' },
          { label: 'Alyce L.', detail: 'Day shift | Staff' },
          { label: 'Barbara J.', detail: 'Night shift | Staff' },
        ],
        dayShiftsFilled: 21,
        dayShiftsTotal: 21,
        nightShiftsFilled: 21,
        nightShiftsTotal: 21,
      })
    )

    expect(html).toContain('1 today safety issue')
    expect(html).toContain('1 shift missing a lead today')
    expect(html).toContain('Assign visible leads before routine planning.')
    expect(html).toContain('Assign leads')
    expect(html).not.toContain('Covered today')
  })

  it('promotes a large review queue above lower-count coverage warnings', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        ...baseProps,
        needsReviewCount: 12,
        needsReviewDetail: 'Unread manager review items are waiting.',
      })
    )

    const topPriorityIndex = html.indexOf('Top priority')
    const reviewIndex = html.indexOf('12 review items waiting')
    const coverageIndex = html.indexOf('2 coverage safety issues')

    expect(topPriorityIndex).toBeGreaterThan(-1)
    expect(reviewIndex).toBeGreaterThan(topPriorityIndex)
    expect(coverageIndex).toBeGreaterThan(reviewIndex)
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

  it('keeps Schedule Block lifecycle states visible in the dashboard workflow', () => {
    const preliminaryHtml = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        ...baseProps,
        currentCycleStatus: 'Preliminary',
      })
    )
    const offlineHtml = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        ...baseProps,
        currentCycleStatus: 'Offline',
      })
    )
    const noShiftDraftHtml = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        ...baseProps,
        currentCycleStatus: 'Draft',
        currentCycleHasNoShifts: true,
      })
    )

    expect(preliminaryHtml).toContain('Schedule status')
    expect(preliminaryHtml).toContain('Preliminary')
    expect(preliminaryHtml).not.toContain('Not published')
    expect(offlineHtml).toContain('Offline')
    expect(offlineHtml).not.toContain('Not published')
    expect(noShiftDraftHtml).toContain('Draft')
    expect(noShiftDraftHtml).toContain('Not started')
  })

  it('keeps availability planning states distinct from ready schedule work', () => {
    const notStartedHtml = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        ...baseProps,
        nextCycleLabel: 'Set availability due date',
        nextCycleDetail: 'The block is not visible to therapists yet.',
      })
    )
    const pendingHtml = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        ...baseProps,
        nextCycleLabel: 'Availability past due May 31',
        nextCycleDetail: 'Review availability responses.',
      })
    )

    expect(notStartedHtml).toContain('Set availability due date')
    expect(notStartedHtml).toContain('Not started')
    expect(pendingHtml).toContain('Availability past due May 31')
    expect(pendingHtml).toContain('Pending')
  })

  it('shows a plain all-clear state when no manager action needs attention', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        ...baseProps,
        todayCoverageCovered: 0,
        todayCoverageTotal: 0,
        upcomingShiftCount: 0,
        upcomingShiftDays: [],
        todayStaffedShifts: [
          { label: 'Adrienne S.', detail: 'Day shift | Lead' },
          { label: 'Barbara J.', detail: 'Night shift | Lead' },
        ],
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

    expect(html).toContain('All clear for now')
    expect(html).toContain('No urgent manager actions are showing.')
    expect(html).toContain('Check staffing and the next Schedule Block when you have time.')
    expect(html).not.toContain('0 coverage safety issues')
    expect(html).not.toContain('Recent activity')
    expect(html).not.toContain('Upcoming exceptions')
    expect(html).not.toContain('Open shifts snapshot')
    expect(html).not.toContain('Open Lottery')
    expect(html).not.toContain('Upcoming Shifts')
  })

  it('uses plain manager-facing copy when dashboard details fail to load', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        ...baseProps,
        dataLoadIssueCount: 2,
      })
    )

    expect(html).toContain('Some dashboard details could not load.')
    expect(html).toContain('Use Schedule as the final staffing source')
    expect(html).not.toContain('Supabase')
    expect(html).not.toContain('RPC')
    expect(html).not.toContain('database')
  })

  it('lists only actionable upcoming exceptions and preserves workflow links', () => {
    const html = renderToStaticMarkup(createElement(ManagerTriageDashboard, baseProps))

    expect(html).toContain('Upcoming exceptions')
    expect(html).toContain('Mar 26')
    expect(html).toContain('4 open shifts')
    expect(html).toContain('Requests queue')
    expect(html).toContain('5 approvals affecting schedule changes')
    expect(html).toContain('Open assignments')
    expect(html).toContain('9 open shifts still need owners.')
    expect(html).not.toContain('Open Lottery')
    expect(html).not.toContain('href="/lottery"')
  })

  it('keeps recent activity conditional and navigable when activity exists', () => {
    const html = renderToStaticMarkup(createElement(ManagerTriageDashboard, baseProps))

    expect(html).toContain('Recent activity')
    expect(html).toContain('Brianna posted a trade request')
    expect(html).toContain('Mar 26 day shift for Mar 28 night shift. Needs manager review.')
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
