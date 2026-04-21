import { CoverageMetric } from '@/components/coverage/coverage-workspace-chrome'

export function CoverageWorkspaceMetrics({
  activeStaffCount,
  issueCount,
  priorityGapDays,
  staffedDays,
  shiftTab,
  unassignedDays,
}: {
  activeStaffCount: number
  issueCount: number
  priorityGapDays: number
  staffedDays: number
  shiftTab: 'Day' | 'Night'
  unassignedDays: number
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <CoverageMetric
        label="Active staff"
        value={String(activeStaffCount)}
        detail={`${shiftTab.toLowerCase()} shift roster`}
      />
      <CoverageMetric
        label="Priority gaps"
        value={String(priorityGapDays)}
        detail="critical days"
        tone={priorityGapDays > 0 ? 'critical' : 'success'}
      />
      <CoverageMetric
        label="Days missing lead"
        value={String(issueCount)}
        detail="lead coverage"
        tone={issueCount > 0 ? 'warning' : 'success'}
      />
      <CoverageMetric
        label="Unassigned days"
        value={String(unassignedDays)}
        detail={`${staffedDays} fully staffed`}
        tone={unassignedDays > 0 ? 'warning' : 'neutral'}
      />
    </section>
  )
}
