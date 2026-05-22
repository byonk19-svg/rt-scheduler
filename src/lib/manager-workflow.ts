import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

type DashboardLinks = {
  approvals: string
  approvalsPending: string
  coverage: string
  fixCoverage: string
  coverageMissingLead: string
  coverageUnderCoverage: string
  coverageUnfilled: string
  coverageNeedsAttention: string
  publish: string
}

function buildCoverageBaseLink(activeCycleId: string | null): string {
  if (!activeCycleId) return '/schedule'
  return `/schedule?cycle=${activeCycleId}`
}

function buildCoverageFilterLink(activeCycleId: string | null, filter: string): string {
  const base = buildCoverageBaseLink(activeCycleId)
  const joiner = base.includes('?') ? '&' : '?'
  return `${base}${joiner}filter=${filter}&focus=first`
}

export function getManagerAttentionLinks(activeCycleId: string | null): DashboardLinks {
  const coverage = buildCoverageBaseLink(activeCycleId)
  const coverageMissingLead = buildCoverageFilterLink(activeCycleId, 'missing_lead')
  return {
    approvals: MANAGER_WORKFLOW_LINKS.approvals,
    approvalsPending: `/approvals?status=pending`,
    coverage,
    fixCoverage: coverageMissingLead,
    coverageMissingLead,
    coverageUnderCoverage: buildCoverageFilterLink(activeCycleId, 'under_coverage'),
    coverageUnfilled: buildCoverageFilterLink(activeCycleId, 'unfilled'),
    coverageNeedsAttention: buildCoverageFilterLink(activeCycleId, 'needs_attention'),
    publish: coverage,
  }
}
