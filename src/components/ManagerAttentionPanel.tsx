import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { cn } from '@/lib/utils'

type ManagerAttentionPanelProps = {
  snapshot: ManagerAttentionSnapshot
  className?: string
}

export function ManagerAttentionPanel({ snapshot, className }: ManagerAttentionPanelProps) {
  return (
    <Card className={cn('no-print', className)}>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              href={snapshot.links.approvalsPending}
              className="font-semibold text-foreground underline-offset-2 hover:underline focus-visible:underline"
              aria-label={`View ${snapshot.pendingApprovals} pending approvals`}
            >
              Pending approvals: {snapshot.pendingApprovals}
            </Link>
            <Link
              href={snapshot.links.coverageUnfilled}
              className="text-foreground underline-offset-2 hover:underline focus-visible:underline"
              aria-label={`View ${snapshot.unfilledShiftSlots} unfilled shifts`}
            >
              Unfilled shifts: {snapshot.unfilledShiftSlots}
            </Link>
            <Link
              href={snapshot.links.coverageMissingLead}
              className="text-foreground underline-offset-2 hover:underline focus-visible:underline"
              aria-label={`View ${snapshot.missingLeadShifts} shifts missing a designated lead`}
            >
              Missing lead: {snapshot.missingLeadShifts}
            </Link>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link
              href={snapshot.links.coverageNeedsAttention}
              className="rounded-md border border-border px-2 py-1 font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Includes missing lead, under coverage, over coverage, and pending approvals."
              aria-label={`Open combined attention items view with ${snapshot.attentionItems} items`}
            >
              Attention: {snapshot.attentionItems}
            </Link>
            <details className="group">
              <summary className="cursor-pointer list-none font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:underline">
                View details
              </summary>
              <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p>Missing lead: {snapshot.missingLeadShifts}</p>
                <p>Under coverage: {snapshot.underCoverageSlots}</p>
                <p>Over coverage: {snapshot.overCoverageSlots}</p>
                <p>Pending approvals: {snapshot.pendingApprovals}</p>
              </div>
            </details>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href={snapshot.links.fixCoverage}>Fix coverage</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={snapshot.links.approvalsPending}>Review approvals</Link>
          </Button>
          {snapshot.publishReady ? (
            <Link href={snapshot.links.publish} className="px-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              Go to publish
            </Link>
          ) : (
            <span
              className="px-1 text-sm font-medium text-muted-foreground"
              title="Publishing is blocked until approvals and coverage issues are resolved."
              aria-label="Go to publish is disabled until blockers are resolved"
            >
              Go to publish
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
