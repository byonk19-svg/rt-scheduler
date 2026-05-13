import { describe, expect, it } from 'vitest'

import { getManagerAttentionLinks } from '@/lib/manager-workflow'

describe('getManagerAttentionLinks', () => {
  it('builds default manager links when no active cycle exists', () => {
    expect(getManagerAttentionLinks(null)).toEqual({
      approvals: '/approvals?status=pending',
      approvalsPending: '/approvals?status=pending',
      coverage: '/schedule',
      fixCoverage: '/schedule?filter=missing_lead&focus=first',
      coverageMissingLead: '/schedule?filter=missing_lead&focus=first',
      coverageUnderCoverage: '/schedule?filter=under_coverage&focus=first',
      coverageUnfilled: '/schedule?filter=unfilled&focus=first',
      coverageNeedsAttention: '/schedule?filter=needs_attention&focus=first',
      publish: '/schedule',
    })
  })

  it('builds cycle-scoped manager links when active cycle exists', () => {
    expect(getManagerAttentionLinks('cycle-abc')).toEqual({
      approvals: '/approvals?status=pending',
      approvalsPending: '/approvals?status=pending',
      coverage: '/schedule?cycle=cycle-abc',
      fixCoverage: '/schedule?cycle=cycle-abc&filter=missing_lead&focus=first',
      coverageMissingLead: '/schedule?cycle=cycle-abc&filter=missing_lead&focus=first',
      coverageUnderCoverage: '/schedule?cycle=cycle-abc&filter=under_coverage&focus=first',
      coverageUnfilled: '/schedule?cycle=cycle-abc&filter=unfilled&focus=first',
      coverageNeedsAttention: '/schedule?cycle=cycle-abc&filter=needs_attention&focus=first',
      publish: '/schedule?cycle=cycle-abc',
    })
  })
})
