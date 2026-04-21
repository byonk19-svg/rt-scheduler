import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const LOADING_LABEL = 'Loading...'

function InboxRow({
  label,
  value,
  detail,
  ctaHref,
  ctaLabel,
}: {
  label: string
  value: string
  detail: string
  ctaHref?: string
  ctaLabel?: string
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{detail}</p>
      {ctaHref && ctaLabel ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 min-h-11 gap-1 px-0 text-xs text-primary"
          asChild
        >
          <Link href={ctaHref}>
            {ctaLabel}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      ) : null}
    </div>
  )
}

export function ManagerTriageSidebar({
  activeCycleDateRange,
  approvalsWaiting,
  isLoading,
  needsReviewCount,
  needsReviewDetail,
  reviewHref,
  scheduleHomeHref,
  scheduleHref,
  upcomingShiftDays,
}: {
  activeCycleDateRange?: string
  approvalsWaiting: number | '--'
  isLoading: boolean
  needsReviewCount: number | '--'
  needsReviewDetail: string
  reviewHref: string
  scheduleHomeHref: string
  scheduleHref: string
  upcomingShiftDays: Array<{ label: string; count: number }>
}) {
  return (
    <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
      <Card className="rounded-2xl border-border/70 bg-card shadow-tw-float-tight">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Manager Inbox
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <InboxRow
            label="Pending approvals"
            value={approvalsWaiting === '--' ? LOADING_LABEL : String(approvalsWaiting)}
            detail={
              approvalsWaiting === '--'
                ? LOADING_LABEL
                : `${approvalsWaiting} waiting for a manager decision`
            }
          />
          <InboxRow
            label="Needs review"
            value={needsReviewCount === '--' ? '--' : String(needsReviewCount)}
            detail={needsReviewDetail}
          />
          <InboxRow
            label="Workflow"
            value="Schedule workflow"
            detail="Start from the manager schedule workspace, then move into coverage, approvals, finalization, and history."
          />
          <Button variant="ghost" size="sm" className="min-h-11 gap-1 px-0 text-xs" asChild>
            <Link href={scheduleHomeHref}>
              Open schedule
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="min-h-11 gap-1 px-0 text-xs" asChild>
            <Link href={reviewHref}>
              {needsReviewCount === 0 ? 'Review workflow updates' : 'Review updates'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card shadow-tw-float-tight">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Upcoming Days
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          {upcomingShiftDays.length > 0 ? (
            upcomingShiftDays.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{item.label}</span>
                <span className="text-muted-foreground">{item.count} shifts</span>
              </div>
            ))
          ) : (
            <div className="text-xs text-muted-foreground">
              <p>{isLoading ? LOADING_LABEL : 'No upcoming shift clusters right now.'}</p>
              {!isLoading ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 min-h-11 gap-1 px-0 text-xs"
                  asChild
                >
                  <Link href={scheduleHref}>
                    See the full schedule
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
