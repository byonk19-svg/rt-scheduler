import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { cn } from '@/lib/utils'

type ManagerAttentionPanelProps = {
  snapshot: ManagerAttentionSnapshot
  className?: string
}

export function ManagerAttentionPanel({ snapshot, className }: ManagerAttentionPanelProps) {
  const hasAttention = snapshot.attentionItems > 0

  return (
    <Card className={cn('no-print', className)}>
      <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs attention</p>
            <Badge variant={hasAttention ? 'destructive' : 'outline'}>
              {hasAttention ? `${snapshot.attentionItems} open item${snapshot.attentionItems === 1 ? '' : 's'}` : 'All clear'}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <Link href={snapshot.links.approvals} className="text-foreground underline-offset-4 hover:underline">
              Pending approvals: <span className="font-semibold">{snapshot.pendingApprovals}</span>
            </Link>
            <Link href={snapshot.links.coverage} className="text-foreground underline-offset-4 hover:underline">
              Unfilled shifts: <span className="font-semibold">{snapshot.unfilledShiftSlots}</span>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            {snapshot.coverageConfirmed
              ? 'Coverage is currently at target for the active cycle.'
              : 'Coverage still has open gaps in the active cycle.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href={snapshot.links.approvals}>Review approvals</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={snapshot.links.coverage}>Review coverage</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
