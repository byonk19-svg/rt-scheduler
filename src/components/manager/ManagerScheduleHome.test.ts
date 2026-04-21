import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ManagerScheduleHome } from '@/components/manager/ManagerScheduleHome'
import { buildManagerScheduleHomeModel } from '@/lib/manager-schedule-home'
import type { ManagerAttentionSnapshot } from '@/lib/manager-workflow'

function createSnapshot(
  overrides: Partial<ManagerAttentionSnapshot> = {}
): ManagerAttentionSnapshot {
  return {
    pendingApprovals: 2,
    unfilledShiftSlots: 3,
    missingLeadShifts: 1,
    underCoverageSlots: 2,
    overCoverageSlots: 0,
    coverageIssues: 3,
    attentionItems: 5,
    coverageConfirmed: false,
    publishReady: false,
    resolveBlockersLink: '/coverage?cycle=cycle-1&view=week&filter=missing_lead&focus=first',
    activeCycle: {
      id: 'cycle-1',
      label: 'May 3 - Jun 13',
      start_date: '2026-05-03',
      end_date: '2026-06-13',
      published: false,
    },
    links: {
      approvals: '/approvals?status=pending',
      approvalsPending: '/approvals?status=pending',
      coverage: '/coverage?cycle=cycle-1&view=week',
      fixCoverage: '/coverage?cycle=cycle-1&view=week&filter=missing_lead&focus=first',
      coverageMissingLead: '/coverage?cycle=cycle-1&view=week&filter=missing_lead&focus=first',
      coverageUnderCoverage: '/coverage?cycle=cycle-1&view=week&filter=under_coverage&focus=first',
      coverageUnfilled: '/coverage?cycle=cycle-1&view=week&filter=unfilled&focus=first',
      coverageNeedsAttention:
        '/coverage?cycle=cycle-1&view=week&filter=needs_attention&focus=first',
      publish: '/publish',
    },
    ...overrides,
  }
}

describe('ManagerScheduleHome', () => {
  it('renders the action-first schedule workspace with workflow cards and secondary references', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerScheduleHome, {
        model: buildManagerScheduleHomeModel(createSnapshot()),
      })
    )

    expect(html).toContain('>Schedule</h1>')
    expect(html).toContain('Continue staffing current block')
    expect(html).toContain('Coverage')
    expect(html).toContain('Approvals')
    expect(html).toContain('Publish')
    expect(html).toContain('Availability')
    expect(html).toContain('Roster')
    expect(html).toContain('Delivery history')
    expect(html).toContain('Analytics')
    expect(html).toContain('May 3 – Jun 13, 2026')
    expect(html).toContain(
      'href="/coverage?cycle=cycle-1&amp;view=week&amp;filter=missing_lead&amp;focus=first"'
    )
  })
})
