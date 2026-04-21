import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const LOADING_LABEL = 'Loading...'

export function ManagerTriageActivityPanel({
  isLoading,
  recentActivity,
  scheduleHref,
  todayActiveShifts,
}: {
  isLoading: boolean
  recentActivity: Array<{ title: string; timeLabel: string; href: string }>
  scheduleHref: string
  todayActiveShifts: Array<{ label: string; detail: string }>
}) {
  return (
    <>
      <Card className="rounded-2xl border-border/70 bg-card shadow-tw-float-tight">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Coverage Risks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          {todayActiveShifts.length > 0 ? (
            todayActiveShifts.map((shift, index) => (
              <div
                key={`${shift.label}-${shift.detail}-${index}`}
                className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-[var(--warning-text)]" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{shift.label}</p>
                    <p className="text-xs text-muted-foreground">{shift.detail}</p>
                  </div>
                </div>
                <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--warning-text)]">
                  Review
                </span>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              <p>{isLoading ? LOADING_LABEL : 'No active shift risks right now.'}</p>
              {!isLoading ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 min-h-11 gap-1 px-0 text-xs"
                  asChild
                >
                  <Link href={scheduleHref}>
                    Open coverage review
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
          {todayActiveShifts.length > 0 ? (
            <Button variant="ghost" size="sm" className="min-h-11 gap-1 px-0 text-xs" asChild>
              <Link href={scheduleHref}>
                Fix coverage
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card shadow-tw-float-tight">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 pb-4">
          {recentActivity.length > 0 ? (
            recentActivity.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="flex items-center justify-between gap-3"
              >
                <p className="text-sm text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.timeLabel}</p>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
              <p>
                {isLoading
                  ? LOADING_LABEL
                  : 'Activity appears here as shifts are drafted, approved, and published.'}
              </p>
              {!isLoading ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 min-h-11 gap-1 px-0 text-xs"
                  asChild
                >
                  <Link href={scheduleHref}>
                    Open schedule activity
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
