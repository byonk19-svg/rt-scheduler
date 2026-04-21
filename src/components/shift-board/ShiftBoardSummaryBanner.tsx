'use client'

import { Button } from '@/components/ui/button'
import { SummaryItem } from '@/components/shift-board/shift-board-primitives'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

type ShiftBoardMetrics = {
  unfilled: number
  missingLead: number
}

export function ShiftBoardSummaryBanner({
  canReview,
  loading,
  metrics,
  onOpenScheduleHome,
  onReviewApprovals,
}: {
  canReview: boolean
  loading: boolean
  metrics: ShiftBoardMetrics
  onOpenScheduleHome: () => void
  onReviewApprovals: () => void
}) {
  if (canReview) {
    return (
      <div
        className="fade-up rounded-xl border border-[var(--warning-border)] bg-[var(--warning-subtle)]/25 shadow-sm"
        style={{ animationDelay: '0.05s' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-6">
            <SummaryItem
              label="Pending approvals"
              value={loading ? '--' : metrics.unfilled + metrics.missingLead}
              variant={
                !loading && metrics.unfilled + metrics.missingLead > 0 ? 'warning' : 'success'
              }
            />
            <div className="hidden h-8 w-px self-center bg-border lg:block" />
            <SummaryItem
              label="Unfilled shifts"
              value={loading ? '--' : metrics.unfilled}
              variant={!loading && metrics.unfilled > 0 ? 'error' : 'success'}
            />
            <div className="hidden h-8 w-px self-center bg-border lg:block" />
            <SummaryItem
              label="Missing lead"
              value={loading ? '--' : metrics.missingLead}
              variant={!loading && metrics.missingLead > 0 ? 'error' : 'success'}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={onReviewApprovals}>
              Review approvals
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenScheduleHome}>
              Open schedule home
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fade-up rounded-xl border border-border bg-card px-5 py-4 shadow-sm"
      style={{ animationDelay: '0.05s' }}
    >
      <p className="text-sm font-semibold text-foreground">Published schedule changes only</p>
      <p className="mt-1 text-sm text-muted-foreground">
        This board is not for future-cycle planning. For the next schedule cycle, open Future
        Availability.
      </p>
    </div>
  )
}
