import { describe, expect, it } from 'vitest'

import { getManagerAttentionLinks } from '@/lib/manager-workflow'

describe('getManagerAttentionLinks', () => {
  it('builds default manager links when no active cycle exists', () => {
    expect(getManagerAttentionLinks(null)).toEqual({
      approvals: '/approvals?status=pending',
      approvalsPending: '/approvals?status=pending',
      coverage: '/coverage?view=week',
      fixCoverage: '/coverage?view=week&filter=missing_lead&focus=first',
      coverageMissingLead: '/coverage?view=week&filter=missing_lead&focus=first',
      coverageUnderCoverage: '/coverage?view=week&filter=under_coverage&focus=first',
      coverageUnfilled: '/coverage?view=week&filter=unfilled&focus=first',
      coverageNeedsAttention: '/coverage?view=week&filter=needs_attention&focus=first',
      publish: '/coverage?view=week',
    })
  })

  it('builds cycle-scoped manager links when active cycle exists', () => {
    expect(getManagerAttentionLinks('cycle-abc')).toEqual({
      approvals: '/approvals?status=pending',
      approvalsPending: '/approvals?status=pending',
      coverage: '/coverage?cycle=cycle-abc&view=week',
      fixCoverage: '/coverage?cycle=cycle-abc&view=week&filter=missing_lead&focus=first',
      coverageMissingLead: '/coverage?cycle=cycle-abc&view=week&filter=missing_lead&focus=first',
      coverageUnderCoverage:
        '/coverage?cycle=cycle-abc&view=week&filter=under_coverage&focus=first',
      coverageUnfilled: '/coverage?cycle=cycle-abc&view=week&filter=unfilled&focus=first',
      coverageNeedsAttention:
        '/coverage?cycle=cycle-abc&view=week&filter=needs_attention&focus=first',
      publish: '/coverage?cycle=cycle-abc&view=week',
    })
  })
})
