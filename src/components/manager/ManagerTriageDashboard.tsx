import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, CalendarDays, FileCheck, Send, Shield, Sparkles, Users } from 'lucide-react'

import { ScheduleProgress } from '@/components/manager/ScheduleProgress'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const LOADING_LABEL = 'Loading...'

type ManagerTriageDashboardProps = {
  todayCoverageCovered: number | '--'
  todayCoverageTotal: number | '--'
  upcomingShiftCount: number | '--'
  upcomingShiftDays: Array<{ label: string; count: number }>
  todayStaffedShifts: Array<{ label: string; detail: string }>
  recentActivity: Array<{ title: string; timeLabel: string; href: string }>
  pendingRequests: number | '--'
  approvalsWaiting: number | '--'
  currentCycleStatus: string
  currentCycleDetail: string
  nextCycleLabel: string
  nextCycleDetail: string
  needsReviewCount: number | '--'
  needsReviewDetail: string
  dayShiftsFilled: number | '--'
  dayShiftsTotal: number | '--'
  nightShiftsFilled: number | '--'
  nightShiftsTotal: number | '--'
  approvalsHref: string
  scheduleHref: string
  reviewHref: string
  activeCycleDateRange?: string
  currentCycleCtaHref?: string
  nextCycleCtaHref?: string
}

export function ManagerTriageDashboard({
  todayCoverageCovered,
  todayCoverageTotal,
  upcomingShiftCount,
  upcomingShiftDays,
  todayStaffedShifts,
  recentActivity,
  pendingRequests,
  approvalsWaiting,
  currentCycleStatus,
  currentCycleDetail,
  nextCycleLabel,
  nextCycleDetail,
  needsReviewCount,
  needsReviewDetail,
  dayShiftsFilled,
  dayShiftsTotal,
  nightShiftsFilled,
  nightShiftsTotal,
  approvalsHref,
  scheduleHref,
  reviewHref,
  activeCycleDateRange,
  currentCycleCtaHref,
  nextCycleCtaHref,
}: ManagerTriageDashboardProps) {
  const isLoading =
    todayCoverageCovered === '--' ||
    todayCoverageTotal === '--' ||
    upcomingShiftCount === '--' ||
    pendingRequests === '--' ||
    needsReviewCount === '--'
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
  const needsReviewLabel =
    needsReviewCount === '--'
      ? LOADING_LABEL
      : `${needsReviewCount} update${needsReviewCount === 1 ? '' : 's'} need review`
  const metricCards = [
    {
      title: 'Coverage Issues',
      value: riskCount === '--' ? '--' : String(riskCount),
      detail: riskCountLabel,
      href: scheduleHref,
      icon: <Shield className="h-4 w-4 text-[var(--error-text)]" />,
      tone: 'error' as const,
    },
    {
      title: 'Pending Approvals',
      value: pendingRequests === '--' ? '--' : String(pendingRequests),
      detail: pendingRequestLabel,
      href: approvalsHref,
      icon: <FileCheck className="h-4 w-4 text-[var(--warning-text)]" />,
      tone: 'warning' as const,
    },
    {
      title: 'Upcoming Shifts',
      value: upcomingShiftCount === '--' ? '--' : String(upcomingShiftCount),
      detail: teamLoadLabel,
      href: scheduleHref,
      icon: <Users className="h-4 w-4 text-primary" />,
      tone: 'info' as const,
    },
  ]
  const nextAction =
    pendingRequests !== '--' && pendingRequests > 0
      ? {
          eyebrow: 'Needs attention now',
          title: `${pendingRequests} approval${pendingRequests === 1 ? '' : 's'} waiting`,
          detail: 'Clear approvals first so access requests and workflow changes do not stall.',
          primaryHref: approvalsHref,
          primaryLabel: 'Review approvals',
          secondaryHref: scheduleHref,
          secondaryLabel: 'Open schedule workspace',
        }
      : riskCount !== '--' && riskCount > 0
        ? {
            eyebrow: 'Needs attention now',
            title: `${riskCount} coverage issue${riskCount === 1 ? '' : 's'} to resolve`,
            detail:
              'Open the schedule workspace and fix unstaffed or unstable days before the next handoff.',
            primaryHref: scheduleHref,
            primaryLabel: 'Open schedule workspace',
            secondaryHref: reviewHref,
            secondaryLabel: 'Review updates',
          }
        : needsReviewCount !== '--' && needsReviewCount > 0
          ? {
              eyebrow: 'Needs attention now',
              title: needsReviewLabel,
              detail: needsReviewDetail,
              primaryHref: reviewHref,
              primaryLabel: 'Review updates',
              secondaryHref: scheduleHref,
              secondaryLabel: 'Open schedule workspace',
            }
          : {
              eyebrow: 'Good standing',
              title: 'No urgent issues right now',
              detail:
                'The current schedule is stable. Use the workspace to keep the next cycle moving.',
              primaryHref: scheduleHref,
              primaryLabel: 'Open schedule workspace',
              secondaryHref: approvalsHref,
              secondaryLabel: 'Check approvals',
            }

  return (
    <div className="max-w-[1120px] space-y-4 px-5 py-5 xl:px-7">
      <div className="relative overflow-hidden rounded-[26px] border border-border/70 bg-card p-5 shadow-tw-inbox-hero">
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-5xl font-bold tracking-[-0.05em] text-foreground">
                Inbox
              </h1>
              {activeCycleDateRange && (
                <span className="rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-xs text-muted-foreground">
                  {activeCycleDateRange}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {nextAction.eyebrow}
              </p>
              <p className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                {nextAction.title}
              </p>
              <p className="max-w-[40rem] text-sm text-muted-foreground">{nextAction.detail}</p>
            </div>
          </div>
          <div className="relative flex flex-wrap gap-2">
            <Button size="sm" className="min-h-11 px-4" asChild>
              <Link href={nextAction.primaryHref}>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {nextAction.primaryLabel}
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="min-h-11 px-4" asChild>
              <Link href={nextAction.secondaryHref}>
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                {nextAction.secondaryLabel}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {metricCards.map((card) => (
              <div key={card.title}>
                <MetricCard {...card} />
              </div>
            ))}
          </div>

          {dayShiftsFilled !== '--' &&
            dayShiftsTotal !== '--' &&
            nightShiftsFilled !== '--' &&
            nightShiftsTotal !== '--' &&
            (dayShiftsTotal === 0 && nightShiftsTotal === 0 ? (
              <div className="relative overflow-hidden rounded-[26px] border border-dashed border-border/70 bg-card/80 px-5 py-5 shadow-none">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
                    <CalendarDays className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Schedule Completion
                    </p>
                    <p className="mt-0.5 font-heading text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
                      No draft started yet
                    </p>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Auto-draft fills the day and night grids based on availability constraints.
                      Takes about 30 seconds.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 min-h-11 gap-1.5 px-3 text-xs"
                      asChild
                    >
                      <Link href={scheduleHref}>
                        <Sparkles className="h-3 w-3" />
                        Open schedule to auto-draft
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <ScheduleProgress
                dayFilled={dayShiftsFilled}
                dayTotal={dayShiftsTotal}
                nightFilled={nightShiftsFilled}
                nightTotal={nightShiftsTotal}
              />
            ))}

          <Card className="rounded-2xl border-border/70 bg-card shadow-tw-float-tight">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Today&apos;s Staffed Shifts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {todayStaffedShifts.length > 0 ? (
                todayStaffedShifts.map((shift, index) => (
                  <div
                    key={`${shift.label}-${shift.detail}-${index}`}
                    className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{shift.label}</p>
                        <p className="text-xs text-muted-foreground">{shift.detail}</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Staffed
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  {isLoading ? LOADING_LABEL : "No staffed shifts on today's schedule."}
                </p>
              )}
              {todayStaffedShifts.length > 0 && (
                <Button variant="ghost" size="sm" className="min-h-11 gap-1 px-0 text-xs" asChild>
                  <Link href={scheduleHref}>
                    Open schedule workspace
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
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
                  <Link
                    key={`${item.title}-${index}`}
                    href={item.href}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-0.5 transition-colors hover:bg-muted/50"
                  >
                    <p className="text-sm text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.timeLabel}</p>
                  </Link>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
                  {isLoading
                    ? LOADING_LABEL
                    : 'Activity appears here as shifts are drafted, approved, and published.'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="rounded-2xl border-border/70 bg-card shadow-tw-float-tight">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Cycle status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <InboxRow
                label="Current cycle"
                value={currentCycleStatus}
                detail={currentCycleDetail}
                ctaHref={currentCycleCtaHref}
                ctaLabel="New 6-week block"
              />
              <InboxRow
                label="Next 6-week cycle"
                value={nextCycleLabel}
                detail={nextCycleDetail}
                ctaHref={nextCycleCtaHref}
                ctaLabel="Plan next cycle"
              />
              <InboxRow
                label="Needs review"
                value={needsReviewCount === '--' ? '--' : String(needsReviewCount)}
                detail={needsReviewDetail}
              />
              <p className="text-[11px] text-muted-foreground">
                {approvalsWaiting === '--' ? LOADING_LABEL : `${approvalsWaiting} waiting`}
              </p>
              <Button variant="ghost" size="sm" className="min-h-11 gap-1 px-0 text-xs" asChild>
                <Link href={reviewHref}>
                  Review updates
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
                <p className="text-xs text-muted-foreground">
                  {isLoading ? LOADING_LABEL : 'No upcoming shift clusters right now.'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  detail,
  href,
  icon,
  tone,
}: {
  title: string
  value: string
  detail: string
  href: string
  icon: ReactNode
  tone: 'error' | 'warning' | 'info'
}) {
  const isEmpty = value === '0' || value === '0%' || value === '--'
  const toneClasses = {
    error: {
      badge: 'bg-[var(--error-subtle)] text-[var(--error-text)]',
    },
    warning: {
      badge: 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
    },
    info: {
      badge: 'bg-[var(--info-subtle)] text-[var(--info-text)]',
    },
  }[tone]

  return (
    <Link href={href} className="block">
      <Card
        className={cn(
          'relative overflow-hidden rounded-[24px] border-border/70 bg-card/95 shadow-tw-metric transition-transform duration-200 hover:-translate-y-0.5',
          isEmpty && 'border-dashed bg-muted/20 shadow-none'
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-foreground">{title}</CardTitle>
          <div className={cn('rounded-full p-2', toneClasses.badge)}>{icon}</div>
        </CardHeader>
        <CardContent className="space-y-1 pb-4">
          <p
            className={cn(
              'font-heading tabular-nums leading-none tracking-[-0.04em]',
              isEmpty
                ? 'text-xl font-semibold text-muted-foreground'
                : 'text-4xl font-bold text-foreground'
            )}
          >
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

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
      {ctaHref && ctaLabel && (
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
      )}
    </div>
  )
}
