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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-foreground">Pending approvals: {snapshot.pendingApprovals}</span>
            <span className="text-foreground">Unfilled shifts: {snapshot.unfilledShiftSlots}</span>
            <span className="text-foreground">Missing lead: {snapshot.missingLeadShifts}</span>
          </div>
          <details className="group">
            <summary className="cursor-pointer list-none rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary">
              Attention: {snapshot.attentionItems}
            </summary>
            <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>Missing lead: {snapshot.missingLeadShifts}</p>
              <p>Under coverage: {snapshot.underCoverageSlots}</p>
              <p>Over coverage: {snapshot.overCoverageSlots}</p>
              <p>Pending approvals: {snapshot.pendingApprovals}</p>
            </div>
          </details>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href={snapshot.links.fixCoverage}>Fix coverage</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={snapshot.links.approvalsPending}>Review approvals</Link>
          </Button>
          {snapshot.publishReady ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={snapshot.links.publish}>Go to publish</Link>
            </Button>
          ) : (
            <span title="Publishing is blocked until approvals and coverage issues are resolved.">
              <Button size="sm" variant="ghost" disabled>
                Go to publish
              </Button>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
