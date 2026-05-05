import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  FileCheck,
  Info,
  ListChecks,
  Rocket,
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
  lotteryHref: string
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
  lotteryHref,
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
  const openAssignments =
    dayShiftsFilled === '--' ||
    dayShiftsTotal === '--' ||
    nightShiftsFilled === '--' ||
    nightShiftsTotal === '--'
      ? '--'
      : Math.max(dayShiftsTotal - dayShiftsFilled, 0) +
        Math.max(nightShiftsTotal - nightShiftsFilled, 0)
  const pendingRequestLabel = pendingRequests === '--' ? LOADING_LABEL : 'Time off & swap requests'
  const upcomingLabel = upcomingShiftCount === '--' ? LOADING_LABEL : 'Next 14 days'
  const needsReviewLabel =
    needsReviewCount === '--'
      ? LOADING_LABEL
      : `${needsReviewCount} update${needsReviewCount === 1 ? '' : 's'} need review`

  const nextAction =
    needsReviewCount !== '--' && needsReviewCount > 0
      ? {
          title: needsReviewLabel,
          detail: needsReviewDetail,
          href: reviewHref,
          label: 'Review updates',
        }
      : riskCount !== '--' && riskCount > 0
        ? {
            title: `${riskCount} shift${riskCount === 1 ? '' : 's'} need coverage review`,
            detail: 'Unstaffed or unstable coverage needs attention before handoff.',
            href: scheduleHref,
            label: 'Review shifts',
          }
        : pendingRequests !== '--' && pendingRequests > 0
          ? {
              title: `${pendingRequests} approval${pendingRequests === 1 ? '' : 's'} waiting`,
              detail: 'Time off and swap requests need manager review.',
              href: approvalsHref,
              label: 'Review requests',
            }
          : {
              title: 'No urgent issues right now',
              detail: 'The current schedule is stable. Keep the next cycle moving.',
              href: scheduleHref,
              label: 'Open schedule',
            }

  const metricCards = [
    {
      title: 'Coverage Issues',
      value: riskCount === '--' ? '--' : String(riskCount),
      detail: riskCount === '--' ? LOADING_LABEL : 'Shifts need attention',
      href: scheduleHref,
      action: 'View details',
      icon: <Shield className="h-3.5 w-3.5" aria-hidden="true" />,
      tone: 'error' as const,
    },
    {
      title: 'Pending Approvals',
      value: pendingRequests === '--' ? '--' : String(pendingRequests),
      detail: pendingRequestLabel,
      href: approvalsHref,
      action: 'Review requests',
      icon: <FileCheck className="h-3.5 w-3.5" aria-hidden="true" />,
      tone: 'warning' as const,
    },
    {
      title: 'Upcoming Shifts',
      value: upcomingShiftCount === '--' ? '--' : String(upcomingShiftCount),
      detail: upcomingLabel,
      href: scheduleHref,
      action: 'View schedule',
      icon: <Users className="h-3.5 w-3.5" aria-hidden="true" />,
      tone: 'info' as const,
    },
    {
      title: 'Open Assignments',
      value: openAssignments === '--' ? '--' : String(openAssignments),
      detail: 'Unfilled shifts',
      href: scheduleHref,
      action: 'See open shifts',
      icon: <Info className="h-3.5 w-3.5" aria-hidden="true" />,
      tone: 'info' as const,
    },
  ]

  const workflowSteps = [
    {
      label: 'Prepare availability',
      detail: 'Confirm time off, shift preferences, and availability.',
      href: nextCycleCtaHref ?? '/availability',
      icon: <Users className="h-5 w-5" aria-hidden="true" />,
      state:
        nextCycleLabel === 'No next cycle'
          ? 'Not started'
          : nextCycleLabel.startsWith('Collect availability')
            ? 'In progress'
            : 'Complete',
    },
    {
      label: 'Build schedule',
      detail:
        currentCycleStatus === 'Draft not started'
          ? currentCycleDetail
          : 'Auto-assign shifts and resolve coverage gaps.',
      href: currentCycleCtaHref ?? scheduleHref,
      icon: <CalendarDays className="h-5 w-5" aria-hidden="true" />,
      state:
        currentCycleStatus === 'Draft not started'
          ? 'Not started'
          : currentCycleStatus === 'No active cycle'
            ? 'Not started'
            : 'Complete',
    },
    {
      label: 'Review changes',
      detail:
        needsReviewCount === '--'
          ? LOADING_LABEL
          : needsReviewCount > 0
            ? needsReviewDetail
            : 'Check warnings, balance workloads, and adjust.',
      href: reviewHref,
      icon: <ListChecks className="h-5 w-5" aria-hidden="true" />,
      state:
        needsReviewCount === '--'
          ? LOADING_LABEL
          : needsReviewCount > 0
            ? 'In progress'
            : 'Complete',
    },
    {
      label: 'Publish schedule',
      detail:
        currentCycleStatus === 'Published'
          ? 'Share schedule with your team.'
          : 'Publish only after coverage and requests are reviewed.',
      href: scheduleHref,
      icon: <Send className="h-5 w-5" aria-hidden="true" />,
      state: currentCycleStatus === 'Published' ? 'Complete' : 'Not started',
    },
  ]

  const todayThisWeekItems = [
    {
      label: 'Today',
      detail:
        approvalsWaiting === '--'
          ? LOADING_LABEL
          : `${approvalsWaiting} time off request${approvalsWaiting === 1 ? '' : 's'} need approval`,
      href: approvalsHref,
      icon: <CalendarDays className="h-5 w-5" aria-hidden="true" />,
    },
    {
      label: 'Next 14 days',
      detail:
        upcomingShiftCount === '--'
          ? LOADING_LABEL
          : `${upcomingShiftCount} shift${upcomingShiftCount === 1 ? '' : 's'} scheduled`,
      href: scheduleHref,
      icon: <Users className="h-5 w-5" aria-hidden="true" />,
    },
    {
      label: 'Coverage review',
      detail:
        riskCount === '--'
          ? LOADING_LABEL
          : `${riskCount} shift${riskCount === 1 ? '' : 's'} need coverage review`,
      href: scheduleHref,
      icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
      tone: 'warning' as const,
    },
    {
      label: 'Next schedule cycle',
      detail:
        nextCycleLabel === 'No next cycle'
          ? nextCycleDetail
          : `${nextCycleLabel} | ${nextCycleDetail}`,
      href: nextCycleCtaHref ?? '/availability',
      icon: <Rocket className="h-5 w-5" aria-hidden="true" />,
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-5 md:py-6 xl:px-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Manager Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Good morning. Here&apos;s what needs your attention.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[31rem]">
          <SelectorPill icon={<Building2 className="h-4 w-4" aria-hidden="true" />}>
            Riverside Medical Center
          </SelectorPill>
          <SelectorPill icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}>
            {activeCycleDateRange ?? 'Current schedule cycle'}
          </SelectorPill>
        </div>
      </div>

      <section
        className={cn(
          'rounded-lg border p-4 shadow-tw-ring-attention sm:flex sm:items-center sm:justify-between sm:gap-4',
          nextAction.title === 'No urgent issues right now'
            ? 'border-[var(--success-border)] bg-[var(--success-subtle)]/35'
            : 'border-[var(--warning-border)] bg-[var(--warning-subtle)]'
        )}
        aria-label="Your next urgent action"
      >
        <div className="flex gap-3">
          <AlertTriangle
            className={cn(
              'mt-1 h-8 w-8 shrink-0',
              nextAction.title === 'No urgent issues right now'
                ? 'text-[var(--success-text)]'
                : 'text-[var(--warning-text)]'
            )}
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-foreground">Your next urgent action</p>
            <p className="mt-0.5 text-xl font-bold text-foreground">{nextAction.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{nextAction.detail}</p>
          </div>
        </div>
        <Button
          className="mt-4 min-h-11 w-full bg-[var(--warning)] text-accent-foreground hover:brightness-105 sm:mt-0 sm:w-auto"
          asChild
        >
          <Link href={nextAction.href}>
            {nextAction.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </section>

      <section
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
        aria-label="Manager status summary"
      >
        {metricCards.map((card) => (
          <MetricCard key={card.title} {...card} />
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="rounded-lg border-border/70 bg-card shadow-tw-float-tight">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold text-foreground">Scheduling workflow</CardTitle>
            <p className="text-sm text-muted-foreground">
              Follow these steps each cycle to build and publish with confidence.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {workflowSteps.map((step, index) => (
              <WorkflowRow key={step.label} stepNumber={index + 1} {...step} />
            ))}
            <Button variant="ghost" size="sm" className="mt-2 min-h-11 px-0 text-xs" asChild>
              <Link href={scheduleHref}>
                View scheduling guide
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-border/70 bg-card shadow-tw-float-tight">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold text-foreground">Today / This week</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/70 pb-4">
            {todayThisWeekItems.map((item) => (
              <ActionListItem key={item.label} {...item} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="rounded-lg border-border/70 bg-card shadow-tw-float-tight">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl font-bold text-foreground">Recent activity</CardTitle>
            <Button variant="ghost" size="sm" className="min-h-11 px-0 text-xs" asChild>
              <Link href="/notifications">
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-border/70 pb-4">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 5).map((item, index) => (
                <Link
                  key={`${item.title}-${index}`}
                  href={item.href}
                  className="flex min-h-14 items-center justify-between gap-3 py-2 text-foreground hover:no-underline"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.timeLabel}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                </Link>
              ))
            ) : (
              <p className="py-5 text-sm text-muted-foreground">
                {isLoading
                  ? LOADING_LABEL
                  : 'Activity appears here as shifts are drafted, approved, and published.'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border-border/70 bg-card shadow-tw-float-tight">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl font-bold text-foreground">
              Open shifts snapshot
            </CardTitle>
            <Button variant="ghost" size="sm" className="min-h-11 px-0 text-xs" asChild>
              <Link href={scheduleHref}>
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {upcomingShiftDays.length > 0 ? (
              upcomingShiftDays.map((item) => (
                <Link
                  key={item.label}
                  href={scheduleHref}
                  className="flex min-h-11 items-center justify-between rounded-md border border-border/70 px-3 text-sm text-foreground hover:bg-muted/40 hover:no-underline"
                >
                  <span>{item.label}</span>
                  <span className="text-[var(--error-text)]">
                    {item.count} shift{item.count === 1 ? '' : 's'}
                  </span>
                </Link>
              ))
            ) : (
              <p className="py-5 text-sm text-muted-foreground">
                {isLoading ? LOADING_LABEL : 'No open shift clusters right now.'}
              </p>
            )}
            <Button variant="ghost" size="sm" className="min-h-11 px-0 text-xs" asChild>
              <Link href={lotteryHref}>
                Open Lottery
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border-border/70 bg-card shadow-tw-float-tight">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Today&apos;s staffed shifts
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 pb-4 md:grid-cols-2">
          {todayStaffedShifts.length > 0 ? (
            todayStaffedShifts.map((shift, index) => (
              <div
                key={`${shift.label}-${shift.detail}-${index}`}
                className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{shift.label}</p>
                    <p className="text-xs text-muted-foreground">{shift.detail}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-[var(--success-border)] bg-[var(--success-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success-text)]">
                  Staffed
                </span>
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground md:col-span-2">
              {isLoading ? LOADING_LABEL : "No staffed shifts on today's schedule."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SelectorPill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 text-sm text-foreground shadow-tw-2xs">
      <span className="flex min-w-0 items-center gap-2">
        <span className="text-primary">{icon}</span>
        <span className="truncate">{children}</span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </div>
  )
}

function MetricCard({
  title,
  value,
  detail,
  href,
  action,
  icon,
  tone,
}: {
  title: string
  value: string
  detail: string
  href: string
  action: string
  icon: ReactNode
  tone: 'error' | 'warning' | 'info'
}) {
  const toneClasses = {
    error: {
      value: 'text-[var(--error-text)]',
      icon: 'bg-[var(--error-subtle)] text-[var(--error-text)]',
    },
    warning: {
      value: 'text-[var(--warning-text)]',
      icon: 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
    },
    info: {
      value: 'text-primary',
      icon: 'bg-[var(--info-subtle)] text-[var(--info-text)]',
    },
  }[tone]

  return (
    <Link
      href={href}
      className="block rounded-lg no-underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 hover:no-underline"
    >
      <Card className="min-h-[7.6rem] gap-2 rounded-lg border-border/70 bg-card py-3 shadow-tw-metric transition-transform duration-200 hover:-translate-y-0.5 sm:min-h-[9.5rem] sm:gap-4 sm:py-4">
        <CardHeader className="flex flex-row items-start justify-between px-3 pb-0 sm:px-4 sm:pb-1">
          <CardTitle className="text-sm font-medium leading-tight text-foreground">
            {title}
          </CardTitle>
          <span className={cn('rounded-full p-1.5', toneClasses.icon)}>{icon}</span>
        </CardHeader>
        <CardContent className="space-y-0.5 px-3 pb-3 sm:space-y-1 sm:px-4 sm:pb-4">
          <p
            className={cn(
              'font-heading text-2xl font-bold leading-none tabular-nums sm:text-4xl',
              toneClasses.value
            )}
          >
            {value}
          </p>
          <p className="text-xs leading-snug text-muted-foreground sm:text-sm">{detail}</p>
          <span className="inline-flex min-h-7 items-center gap-1 pt-0.5 text-xs font-medium text-primary sm:min-h-9 sm:pt-1">
            {action}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}

function WorkflowRow({
  stepNumber,
  label,
  detail,
  href,
  icon,
  state,
}: {
  stepNumber: number
  label: string
  detail: string
  href: string
  icon: ReactNode
  state: string
}) {
  const isComplete = state === 'Complete'
  const isActive = state === 'In progress'

  return (
    <Link
      href={href}
      className={cn(
        'grid min-h-[4.25rem] grid-cols-[2.25rem_2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2 text-foreground hover:no-underline',
        isActive
          ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)]/50'
          : 'border-border/70 bg-card hover:bg-muted/30'
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold',
          isComplete
            ? 'bg-primary text-primary-foreground'
            : isActive
              ? 'bg-[var(--warning)] text-accent-foreground'
              : 'bg-muted text-muted-foreground'
        )}
      >
        {stepNumber}
      </span>
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <span
        className={cn(
          'hidden items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex',
          isComplete
            ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
            : isActive
              ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
              : 'border-border bg-muted/50 text-muted-foreground'
        )}
      >
        {isComplete ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : null}
        {state}
      </span>
    </Link>
  )
}

function ActionListItem({
  label,
  detail,
  href,
  icon,
  tone,
}: {
  label: string
  detail: string
  href: string
  icon: ReactNode
  tone?: 'warning'
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[4.5rem] items-center justify-between gap-3 py-2 text-foreground hover:no-underline"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            tone === 'warning'
              ? 'text-[var(--error-text)]'
              : 'bg-[var(--info-subtle)] text-[var(--info-text)]'
          )}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">{detail}</span>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}
