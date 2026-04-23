import Link from 'next/link'
import { ArrowRightLeft, CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function ShiftBoardHeader({
  canReview,
  employmentType,
  loading,
  openPostCount,
  pending,
  metrics,
  onOpenScheduleHome,
}: {
  canReview: boolean
  employmentType: string | null
  loading: boolean
  openPostCount: number
  pending: number
  metrics: { unfilled: number; missingLead: number }
  onOpenScheduleHome: () => void
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-6 pb-4 pt-5 shadow-tw-float">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Open shifts
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {canReview
              ? 'Review and approve swap and pickup requests in the live schedule.'
              : 'Post swaps or pickups for the published schedule only.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5 text-muted-foreground">
              {loading ? '--' : openPostCount} open
            </span>
            <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5 text-muted-foreground">
              {loading ? '--' : pending} pending
            </span>
            {canReview ? (
              <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[var(--warning-text)]">
                {loading ? '--' : metrics.unfilled + metrics.missingLead} needs attention
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReview ? (
            <Button size="sm" className="gap-1.5 text-xs" onClick={onOpenScheduleHome}>
              <CalendarDays className="h-3.5 w-3.5" />
              Open schedule home
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5 text-xs" asChild>
              <Link href="/requests/new">
                <ArrowRightLeft className="h-3.5 w-3.5" />
                {employmentType === 'prn' ? 'Express interest' : 'Post request'}
              </Link>
            </Button>
          )}
          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link href="/availability">Future availability</Link>
          </Button>
          {!canReview && (
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link href="/staff/history">View my history</Link>
            </Button>
          )}
          {canReview && (
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link href="/coverage">Open coverage</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
