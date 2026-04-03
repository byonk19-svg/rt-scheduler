import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileCheck,
  Send,
  Shield,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const LOADING_LABEL = 'Loading...'

type ManagerTriageDashboardProps = {
  todayCoverageCovered: number | '--'
  todayCoverageTotal: number | '--'
  upcomingShiftCount: number | '--'
  upcomingShiftDays: Array<{ label: string; count: number }>
  todayActiveShifts: Array<{ label: string; detail: string }>
  recentActivity: Array<{ title: string; timeLabel: string; href: string }>
  pendingRequests: number | '--'
  approvalsWaiting: number | '--'
  currentCycleStatus: string
  currentCycleDetail: string
  nextCycleLabel: string
  nextCycleDetail: string
  needsReviewCount: number | '--'
  needsReviewDetail: string
  approvalsHref: string
  scheduleHref: string
  reviewHref: string
}

export function ManagerTriageDashboard({
  todayCoverageCovered,
  todayCoverageTotal,
  upcomingShiftCount,
  upcomingShiftDays,
  todayActiveShifts,
  recentActivity,
  pendingRequests,
  approvalsWaiting,
  currentCycleStatus,
  currentCycleDetail,
  nextCycleLabel,
  nextCycleDetail,
  needsReviewCount,
  needsReviewDetail,
  approvalsHref,
  scheduleHref,
  reviewHref,
}: ManagerTriageDashboardProps) {
  const isLoading =
    todayCoverageCovered === '--' ||
    todayCoverageTotal === '--' ||
    upcomingShiftCount === '--' ||
    pendingRequests === '--' ||
    needsReviewCount === '--'
  const coveragePercent = getCoveragePercent(todayCoverageCovered, todayCoverageTotal)
  const riskCount =
    todayCoverageCovered === '--' || todayCoverageTotal === '--'
      ? '--'
      : Math.max(todayCoverageTotal - todayCoverageCovered, 0)
  const riskCountLabel =
    riskCount === '--' ? LOADING_LABEL : `${riskCount} ${riskCount === 1 ? 'issue' : 'issues'}`
  const pendingRequestLabel =
    pendingRequests === '--' ? LOADING_LABEL : `${pendingRequests} pending`
  const teamLoadLabel =
    upcomingShiftCount === '--' ? LOADING_LABEL : `${upcomingShiftCount} upcoming shifts`

  return (
    <div className="max-w-[1120px] space-y-4 px-5 py-5 xl:px-7">
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[1.85rem] font-semibold tracking-tight text-foreground">
              Manager Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Current cycle status, staffing risk, and approval triage in one place.
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-[var(--error-border)] bg-[var(--error-subtle)] px-2 py-0.5 text-[var(--error-text)]">
                {riskCountLabel}
              </span>
              <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5">
                {pendingRequestLabel}
              </span>
              <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5">
                {teamLoadLabel}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-9 px-4" asChild>
              <Link href={scheduleHref}>
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                Open schedule
              </Link>
            </Button>
            <Button size="sm" className="h-9 px-4" asChild>
              <Link href={approvalsHref}>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Publish flow
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <MetricCard
          title="Coverage Issues"
          value={riskCount === '--' ? '--' : String(riskCount)}
          detail={riskCountLabel}
          href={scheduleHref}
          icon={<Shield className="h-4 w-4 text-[var(--error-text)]" />}
          emptyPrompt="No coverage gaps - review the schedule to confirm."
        />
        <MetricCard
          title="Pending Approvals"
          value={pendingRequests === '--' ? '--' : String(pendingRequests)}
          detail={pendingRequestLabel}
          href={approvalsHref}
          icon={<FileCheck className="h-4 w-4 text-[var(--warning-text)]" />}
          emptyPrompt="Send a preliminary schedule to collect staff claims."
        />
        <MetricCard
          title="Upcoming Shifts"
          value={upcomingShiftCount === '--' ? '--' : String(upcomingShiftCount)}
          detail={teamLoadLabel}
          href={scheduleHref}
          icon={<Users className="h-4 w-4 text-primary" />}
          emptyPrompt="Auto-draft or manually assign shifts for this cycle."
        />
        <MetricCard
          title="Publish Readiness"
          value={coveragePercent === null ? '--' : `${coveragePercent}%`}
          detail={coveragePercent === null ? LOADING_LABEL : `${coveragePercent}% ready`}
          href={reviewHref}
          icon={<CheckCircle2 className="h-4 w-4 text-[var(--warning-text)]" />}
          emptyPrompt="Assign shifts and leads before publishing."
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[2fr_1fr]">
        <Card className="rounded-2xl border-border/70 bg-card shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-foreground">Coverage Risks</CardTitle>
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
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                {isLoading ? LOADING_LABEL : 'No active shift risks right now.'}
              </p>
            )}
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-0 text-xs" asChild>
              <Link href={scheduleHref}>
                Fix coverage
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="rounded-2xl border-border/70 bg-card shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-foreground">Manager Inbox</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <InboxRow
                label="Current cycle"
                value={currentCycleStatus}
                detail={currentCycleDetail}
              />
              <InboxRow label="Next 6-week cycle" value={nextCycleLabel} detail={nextCycleDetail} />
              <InboxRow
                label="Needs review"
                value={needsReviewCount === '--' ? '--' : String(needsReviewCount)}
                detail={needsReviewDetail}
              />
              <p className="text-[11px] text-muted-foreground">
                {approvalsWaiting === '--' ? LOADING_LABEL : `${approvalsWaiting} waiting`}
              </p>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-0 text-xs" asChild>
                <Link href={reviewHref}>
                  Review updates
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-foreground">Upcoming Days</CardTitle>
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
                <p className="text-xs text-muted-foreground">
                  {isLoading ? LOADING_LABEL : 'No upcoming shift clusters right now.'}
                </p>
              )}
              <div className="pt-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="rounded-2xl border-border/70 bg-card shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-foreground">Recent Activity</CardTitle>
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
            <p className="text-xs text-muted-foreground">
              {isLoading ? LOADING_LABEL : 'No recent activity.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  title,
  value,
  detail,
  href,
  icon,
  emptyPrompt,
}: {
  title: string
  value: string
  detail: string
  href: string
  icon: ReactNode
  emptyPrompt?: string
}) {
  const isActionableEmpty = value === '0' || value === '0%' || value === '--'

  return (
    <Card
      className={cn(
        'rounded-2xl border-border/70 bg-card shadow-[0_1px_8px_rgba(15,23,42,0.04)]',
        isActionableEmpty && 'border-dashed bg-muted/20 shadow-none'
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="space-y-1.5 pb-4">
        <p
          className={cn(
            'leading-none tracking-tight',
            isActionableEmpty
              ? 'text-lg font-semibold text-muted-foreground'
              : 'text-2xl font-semibold text-foreground'
          )}
        >
          {value}
        </p>
        <p className="text-xs text-muted-foreground">
          {isActionableEmpty && emptyPrompt ? emptyPrompt : detail}
        </p>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-0 text-xs" asChild>
          <Link href={href}>
            {isActionableEmpty && emptyPrompt ? 'Go' : 'Open'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function InboxRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{detail}</p>
    </div>
  )
}

function getCoveragePercent(covered: number | '--', total: number | '--') {
  if (covered === '--' || total === '--') return null
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((covered / total) * 100)))
}
