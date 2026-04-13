import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  FileCheck,
  Send,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react'
import { motion } from 'framer-motion'

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
  const approvalsWaitingLabel =
    approvalsWaiting === '--' ? LOADING_LABEL : `${approvalsWaiting} waiting for review`

  const fadeUp = {
    hidden: { opacity: 0, y: 8 },
    show: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: index * 0.06, duration: 0.3 },
    }),
  }
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

  return (
    <div className="max-w-[1120px] space-y-6 px-5 py-5 xl:px-7">
      {/* Hero header — more internal breathing room */}
      <div className="teamwise-aurora-bg relative overflow-hidden rounded-[26px] border border-border/70 bg-card px-6 py-6 shadow-tw-inbox-hero">
        <div className="teamwise-grid-bg-subtle absolute inset-0 opacity-70" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
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
          </div>
          <div className="relative flex gap-2">
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

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        {/* Main column — varied spacing between sections */}
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {metricCards.map((card, index) => (
              <motion.div
                key={card.title}
                custom={index}
                variants={fadeUp}
                initial="hidden"
                animate="show"
              >
                <MetricCard {...card} />
              </motion.div>
            ))}
          </div>

          {dayShiftsFilled !== '--' &&
            dayShiftsTotal !== '--' &&
            nightShiftsFilled !== '--' &&
            nightShiftsTotal !== '--' &&
            (dayShiftsTotal === 0 && nightShiftsTotal === 0 ? (
              <div className="relative overflow-hidden rounded-[26px] border border-dashed border-border/70 bg-card/80 px-6 py-5 shadow-none">
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
                      className="mt-3 h-7 gap-1.5 text-xs"
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

          {/* Coverage Risks — divider rows instead of nested bordered boxes */}
          <Card className="rounded-2xl border-border/70 bg-card shadow-tw-float-tight">
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Coverage Risks
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {todayActiveShifts.length > 0 ? (
                <div>
                  {todayActiveShifts.map((shift, index) => (
                    <div
                      key={`${shift.label}-${shift.detail}-${index}`}
                      className={cn(
                        'flex items-center justify-between py-2.5',
                        index > 0 && 'border-t border-border/50'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--warning-text)]" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{shift.label}</p>
                          <p className="text-xs text-muted-foreground">{shift.detail}</p>
                        </div>
                      </div>
                      <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--warning-text)]">
                        Review
                      </span>
                    </div>
                  ))}
                  <div className="mt-1 border-t border-border/50 pt-2">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 px-0 text-xs" asChild>
                      <Link href={scheduleHref}>
                        Fix coverage
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  {isLoading ? LOADING_LABEL : 'No active shift risks right now.'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity — dividers between items */}
          <Card className="rounded-2xl border-border/70 bg-card shadow-tw-float-tight">
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {recentActivity.length > 0 ? (
                <div>
                  {recentActivity.map((item, index) => (
                    <div
                      key={`${item.title}-${index}`}
                      className={cn(
                        'flex items-center justify-between gap-3 py-2.5',
                        index > 0 && 'border-t border-border/50'
                      )}
                    >
                      <p className="text-sm text-foreground">{item.title}</p>
                      <p className="shrink-0 text-xs text-muted-foreground">{item.timeLabel}</p>
                    </div>
                  ))}
                </div>
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

        {/* Sidebar — sticky, matches main column gap */}
        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          {/* Manager Inbox — dividers between rows */}
          <Card className="rounded-2xl border-border/70 bg-card shadow-tw-float-tight">
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Manager Inbox
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-0">
                <InboxRow
                  label="Current cycle"
                  value={currentCycleStatus}
                  detail={currentCycleDetail}
                  ctaHref={currentCycleCtaHref}
                  ctaLabel="New 6-week block"
                />
                <div className="border-t border-border/50 pt-3">
                  <InboxRow
                    label="Next 6-week cycle"
                    value={nextCycleLabel}
                    detail={nextCycleDetail}
                    ctaHref={nextCycleCtaHref}
                    ctaLabel="Plan next cycle"
                  />
                </div>
                <div className="border-t border-border/50 pt-3">
                  <InboxRow
                    label="Needs review"
                    value={needsReviewCount === '--' ? '--' : String(needsReviewCount)}
                    detail={needsReviewDetail}
                    subDetail={approvalsWaitingLabel}
                    ctaHref={reviewHref}
                    ctaLabel="Review updates"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Days — dividers between day rows */}
          <Card className="rounded-2xl border-border/70 bg-card shadow-tw-float-tight">
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Upcoming Days
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {upcomingShiftDays.length > 0 ? (
                <div>
                  {upcomingShiftDays.map((item, index) => (
                    <div
                      key={item.label}
                      className={cn(
                        'flex items-center justify-between py-2 text-xs',
                        index > 0 && 'border-t border-border/50'
                      )}
                    >
                      <span className="text-foreground">{item.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {item.count} shifts
                      </span>
                    </div>
                  ))}
                </div>
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
      stripe: 'bg-[var(--error)]',
      badge: 'bg-[var(--error-subtle)] text-[var(--error-text)]',
    },
    warning: {
      stripe: 'bg-[var(--warning)]',
      badge: 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
    },
    info: {
      stripe: 'bg-primary',
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
        <div className={cn('absolute inset-x-0 top-0 h-1', toneClasses.stripe)} />
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-foreground">{title}</CardTitle>
          <div className={cn('rounded-full p-2', toneClasses.badge)}>{icon}</div>
        </CardHeader>
        <CardContent className="space-y-1 pb-5">
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
  subDetail,
  ctaHref,
  ctaLabel,
}: {
  label: string
  value: string
  detail: string
  subDetail?: string
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
      {subDetail && <p className="mt-0.5 text-[11px] text-muted-foreground">{subDetail}</p>}
      {ctaHref && ctaLabel && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-6 gap-1 px-0 text-xs text-primary"
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
