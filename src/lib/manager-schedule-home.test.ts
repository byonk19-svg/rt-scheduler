import { describe, expect, it } from 'vitest'

import type { ManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { buildManagerScheduleHomeModel } from '@/lib/manager-schedule-home'

function createSnapshot(
  overrides: Partial<ManagerAttentionSnapshot> = {}
): ManagerAttentionSnapshot {
  return {
    pendingApprovals: 0,
    unfilledShiftSlots: 0,
    missingLeadShifts: 0,
    underCoverageSlots: 0,
    overCoverageSlots: 0,
    coverageIssues: 0,
    attentionItems: 0,
    coverageConfirmed: true,
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

describe('buildManagerScheduleHomeModel', () => {
  it('prefers coverage as the primary action when staffing blockers exist', () => {
    const model = buildManagerScheduleHomeModel(
      createSnapshot({
        coverageIssues: 4,
        missingLeadShifts: 2,
        underCoverageSlots: 2,
        publishReady: false,
      })
    )

    expect(model.primaryAction.label).toBe('Continue staffing current block')
    expect(model.primaryAction.href).toBe(
      '/coverage?cycle=cycle-1&view=week&filter=missing_lead&focus=first'
    )
    expect(model.blockers.map((item) => item.label)).toEqual([
      'Coverage issues',
      'Missing lead days',
      'Pending approvals',
      'Publish readiness',
    ])
  })

  it('promotes approvals when coverage is clear but pending review remains', () => {
    const model = buildManagerScheduleHomeModel(
      createSnapshot({
        pendingApprovals: 3,
        attentionItems: 3,
      })
    )

    expect(model.primaryAction.label).toBe('Review pending approvals')
    expect(model.primaryAction.href).toBe('/approvals?status=pending')
    expect(model.workflowCards.map((card) => card.label)).toEqual([
      'Coverage',
      'Approvals',
      'Publish',
      'Availability',
    ])
  })

  it('falls through to publish readiness when no blockers remain', () => {
    const model = buildManagerScheduleHomeModel(
      createSnapshot({
        publishReady: true,
      })
    )

    expect(model.primaryAction.label).toBe('Finalize schedule')
    expect(model.primaryAction.href).toBe('/publish')
    expect(model.secondaryLinks.map((item) => item.label)).toEqual([
      'Roster',
      'Delivery history',
      'Analytics',
    ])
  })
})
