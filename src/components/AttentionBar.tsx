import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { cn } from '@/lib/utils'

type AttentionBarVariant = 'full' | 'compact'
type AttentionContext = 'dashboard' | 'coverage' | 'approvals' | 'shiftboard'
type MetricLink = {
  href: string
  label: string
  ariaLabel: string
  emphasized?: boolean
}

type AttentionBarProps = {
  snapshot: ManagerAttentionSnapshot
  variant?: AttentionBarVariant
  context?: AttentionContext
  className?: string
}

function metricLinkClass() {
  return 'rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
}

function compactPrimaryCtaForContext(
  context: AttentionContext,
  snapshot: ManagerAttentionSnapshot
) {
  if (context === 'approvals' || context === 'shiftboard') {
    return { href: snapshot.links.approvalsPending, label: 'Review approvals' }
  }
  return { href: snapshot.links.fixCoverage, label: 'Fix coverage' }
}

function metricsForContext(
  context: AttentionContext,
  snapshot: ManagerAttentionSnapshot
): MetricLink[] {
  if (context === 'approvals') {
    return [
      {
        href: snapshot.links.approvalsPending,
        label: `Pending approvals: ${snapshot.pendingApprovals}`,
        ariaLabel: `View ${snapshot.pendingApprovals} pending approvals`,
        emphasized: true,
      },
      {
        href: snapshot.links.coverageMissingLead,
        label: `Missing lead: ${snapshot.missingLeadShifts}`,
        ariaLabel: `View ${snapshot.missingLeadShifts} shifts missing a designated lead`,
      },
    ]
  }

  if (context === 'shiftboard') {
    return [
      {
        href: snapshot.links.approvalsPending,
        label: `Pending approvals: ${snapshot.pendingApprovals}`,
        ariaLabel: `View ${snapshot.pendingApprovals} pending approvals`,
        emphasized: true,
      },
      {
        href: snapshot.links.coverageUnfilled,
        label: `Unfilled shifts: ${snapshot.unfilledShiftSlots}`,
        ariaLabel: `View ${snapshot.unfilledShiftSlots} unfilled shifts`,
      },
      {
        href: snapshot.links.coverageMissingLead,
        label: `Missing lead: ${snapshot.missingLeadShifts}`,
        ariaLabel: `View ${snapshot.missingLeadShifts} shifts missing a designated lead`,
      },
    ]
  }

  if (context === 'coverage') {
    return [
      {
        href: snapshot.links.coverageMissingLead,
        label: `Missing lead: ${snapshot.missingLeadShifts}`,
        ariaLabel: `View ${snapshot.missingLeadShifts} shifts missing a designated lead`,
        emphasized: true,
      },
      {
        href: snapshot.links.coverageUnderCoverage,
        label: `Under coverage: ${snapshot.underCoverageSlots}`,
        ariaLabel: `View ${snapshot.underCoverageSlots} under coverage shifts`,
      },
      {
        href: snapshot.links.coverageUnfilled,
        label: `Unfilled shifts: ${snapshot.unfilledShiftSlots}`,
        ariaLabel: `View ${snapshot.unfilledShiftSlots} unfilled shifts`,
      },
      {
        href: snapshot.links.approvalsPending,
        label: `Pending approvals: ${snapshot.pendingApprovals}`,
        ariaLabel: `View ${snapshot.pendingApprovals} pending approvals`,
      },
    ]
  }

  return [
    {
      href: snapshot.links.coverageUnfilled,
      label: `Unfilled shifts: ${snapshot.unfilledShiftSlots}`,
      ariaLabel: `View ${snapshot.unfilledShiftSlots} unfilled shifts`,
      emphasized: true,
    },
    {
      href: snapshot.links.coverageMissingLead,
      label: `Missing lead: ${snapshot.missingLeadShifts}`,
      ariaLabel: `View ${snapshot.missingLeadShifts} shifts missing a designated lead`,
    },
    {
      href: snapshot.links.coverageUnderCoverage,
      label: `Under coverage: ${snapshot.underCoverageSlots}`,
      ariaLabel: `View ${snapshot.underCoverageSlots} under coverage shifts`,
    },
    {
      href: snapshot.links.approvalsPending,
      label: `Pending approvals: ${snapshot.pendingApprovals}`,
      ariaLabel: `View ${snapshot.pendingApprovals} pending approvals`,
    },
  ]
}

export function AttentionBar({
  snapshot,
  variant = 'full',
  context = 'dashboard',
  className,
}: AttentionBarProps) {
  const metrics = metricsForContext(context, snapshot)
  const compactPrimaryCta = compactPrimaryCtaForContext(context, snapshot)

  const compactDetails = (
    <details>
      <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground underline-offset-2 hover:underline">
        View details
      </summary>
      <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p>Pending approvals: {snapshot.pendingApprovals}</p>
        <p>Missing lead: {snapshot.missingLeadShifts}</p>
        <p>Under coverage: {snapshot.underCoverageSlots}</p>
        <p>Unfilled shifts: {snapshot.unfilledShiftSlots}</p>
      </div>
    </details>
  )

  return (
    <Card className={cn('no-print', className)}>
      <CardContent className={cn(variant === 'full' ? 'space-y-3 py-4' : 'space-y-3 py-3')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {metrics.map((metric) => (
              <Link
                key={`${context}-${metric.href}-${metric.label}`}
                href={metric.href}
                className={cn(
                  metricLinkClass(),
                  metric.emphasized ? 'font-semibold text-foreground' : 'text-foreground'
                )}
                aria-label={metric.ariaLabel}
              >
                {metric.label}
              </Link>
            ))}
          </div>

          {variant === 'full' ? <div className="text-xs">{compactDetails}</div> : compactDetails}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {variant === 'full' ? (
            <>
              <Button asChild size="sm" className="bg-[#d97706] text-white hover:bg-[#b45309]">
                <Link href={snapshot.links.fixCoverage}>Fix coverage</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={snapshot.links.approvalsPending}>Review approvals</Link>
              </Button>
              {snapshot.publishReady ? (
                <Link
                  href={snapshot.links.publish}
                  className="px-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
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
            </>
          ) : (
            <Button asChild size="sm" className="bg-[#d97706] text-white hover:bg-[#b45309]">
              <Link href={compactPrimaryCta.href}>{compactPrimaryCta.label}</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
