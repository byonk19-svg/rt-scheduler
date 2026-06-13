import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileCheck,
  ListChecks,
  Moon,
  Shield,
  Sun,
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
  currentCycleHasNoShifts?: boolean
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
  dataLoadIssueCount?: number
}

type ShiftSummary = {
  key: 'day' | 'night'
  label: string
  lead: string | null
  staff: string[]
  openCount: number
}

type AttentionItem = {
  key: string
  count: number | '--'
  label: string
  detail: string
  href: string
  action: string
  icon: ReactNode
  tone: 'danger' | 'warning' | 'success' | 'muted'
  show: boolean
}

function getAttentionPriority(item: AttentionItem): number {
  if (item.count === '--') return 10

  const toneWeight = item.tone === 'danger' ? 4000 : item.tone === 'warning' ? 3000 : 1000
  const countWeight = Math.min(item.count, 999)

  if (item.key === 'review' && item.count >= 10) return 5000 + countWeight
  if (item.key === 'open-shifts' && item.count > 0) return toneWeight + 300 + countWeight
  if (item.key === 'approvals' && item.count > 0) return toneWeight + 200 + countWeight
  if (item.key === 'leads' && item.count > 0) return toneWeight + 100 + countWeight
  if (item.key === 'coverage' && item.count > 0) return 4500 + countWeight

  return toneWeight + countWeight
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function isLoadingValue(value: number | '--'): value is '--' {
  return value === '--'
}

function parseShiftDetail(detail: string): {
  shift: 'day' | 'night' | 'unknown'
  role: 'lead' | 'staff' | 'unknown'
} {
  const normalized = detail.toLowerCase()
  return {
    shift: normalized.includes('night') ? 'night' : normalized.includes('day') ? 'day' : 'unknown',
    role: normalized.includes('lead') ? 'lead' : normalized.includes('staff') ? 'staff' : 'unknown',
  }
}

function buildTodayShiftSummaries(rows: Array<{ label: string; detail: string }>): ShiftSummary[] {
  const summaries: ShiftSummary[] = [
    { key: 'day', label: 'Day shift', lead: null, staff: [], openCount: 0 },
    { key: 'night', label: 'Night shift', lead: null, staff: [], openCount: 0 },
  ]

  for (const row of rows) {
    const parsed = parseShiftDetail(row.detail)
    if (parsed.shift === 'unknown') continue

    const summary = summaries.find((item) => item.key === parsed.shift)
    if (!summary) continue

    if (row.label === 'Unassigned therapist') {
      summary.openCount += 1
      continue
    }

    if (parsed.role === 'lead' && !summary.lead) {
      summary.lead = row.label
      continue
    }

    summary.staff.push(row.label)
  }

  return summaries
}

function getCycleStepState(args: {
  currentCycleStatus: string
  currentCycleHasNoShifts?: boolean
  needsReviewCount: number | '--'
  nextCycleLabel: string
}): Array<{ label: string; value: string; tone: 'success' | 'warning' | 'muted' }> {
  const availabilityState =
    args.nextCycleLabel === 'No next Schedule Block' ||
    args.nextCycleLabel.startsWith('Plan the next') ||
    args.nextCycleLabel.startsWith('Set availability')
      ? 'Not started'
      : args.nextCycleLabel.startsWith('Availability due') ||
          args.nextCycleLabel.startsWith('Availability past due')
        ? 'Pending'
        : 'Ready'
  const buildState =
    args.currentCycleHasNoShifts || args.currentCycleStatus === 'No active Schedule Block'
      ? 'Not started'
      : 'Complete'
  const reviewState =
    args.needsReviewCount === '--'
      ? LOADING_LABEL
      : args.needsReviewCount > 0
        ? `${args.needsReviewCount} to review`
        : 'Complete'
  const publishState =
    args.currentCycleStatus === 'No active Schedule Block'
      ? 'Not published'
      : args.currentCycleStatus
  const publishTone =
    publishState === 'Published'
      ? 'success'
      : publishState === 'Preliminary' || publishState === 'Offline'
        ? 'warning'
        : 'muted'

  return [
    {
      label: 'Availability',
      value: availabilityState,
      tone: availabilityState === 'Ready' ? 'success' : 'warning',
    },
    {
      label: 'Build',
      value: buildState,
      tone: buildState === 'Complete' ? 'success' : 'muted',
    },
    {
      label: 'Review',
      value: reviewState,
      tone: reviewState === 'Complete' ? 'success' : 'warning',
    },
    {
      label: 'Publish',
      value: publishState,
      tone: publishTone,
    },
  ]
}

function getManagerChecklistSteps(args: {
  coverageIssueCount: number | '--'
  openAssignmentCount: number | '--'
  needsReviewCount: number | '--'
  needsReviewDetail: string
  nextCycleLabel: string
  nextCycleDetail: string
  currentCycleStatus: string
  currentCycleDetail: string
}) {
  const coverageValue =
    args.coverageIssueCount === '--'
      ? LOADING_LABEL
      : args.coverageIssueCount > 0
        ? `${pluralize(args.coverageIssueCount, 'coverage issue')}`
        : 'Covered today'
  const reviewValue =
    args.needsReviewCount === '--'
      ? LOADING_LABEL
      : args.needsReviewCount > 0
        ? `${pluralize(args.needsReviewCount, 'item')} waiting`
        : 'No decisions waiting'
  const assignmentValue =
    args.openAssignmentCount === '--'
      ? LOADING_LABEL
      : args.openAssignmentCount > 0
        ? `${pluralize(args.openAssignmentCount, 'open shift')}`
        : 'Schedule filled'

  return [
    {
      label: 'Make today safe',
      value: coverageValue,
      detail:
        args.coverageIssueCount !== '--' && args.coverageIssueCount > 0
          ? 'Fix today first before routine planning.'
          : 'No coverage safety issue is showing for today.',
      tone:
        args.coverageIssueCount !== '--' && args.coverageIssueCount > 0
          ? ('warning' as const)
          : ('success' as const),
    },
    {
      label: 'Clear manager decisions',
      value: reviewValue,
      detail:
        args.needsReviewCount !== '--' && args.needsReviewCount > 0
          ? args.needsReviewDetail
          : 'Approvals and manager reviews are caught up.',
      tone:
        args.needsReviewCount !== '--' && args.needsReviewCount > 0
          ? ('warning' as const)
          : ('success' as const),
    },
    {
      label: 'Fill the schedule',
      value: assignmentValue,
      detail:
        args.openAssignmentCount !== '--' && args.openAssignmentCount > 0
          ? 'Assign open shifts before publish.'
          : 'No open assignments are showing for this Schedule Block.',
      tone:
        args.openAssignmentCount !== '--' && args.openAssignmentCount > 0
          ? ('warning' as const)
          : ('success' as const),
    },
    {
      label: 'Prepare the next block',
      value: args.nextCycleLabel,
      detail: args.nextCycleDetail || args.currentCycleDetail,
      tone:
        args.currentCycleStatus === 'Published' && args.nextCycleLabel === 'No next Schedule Block'
          ? ('muted' as const)
          : ('warning' as const),
    },
  ]
}

export function ManagerTriageDashboard({
  todayCoverageCovered,
  todayCoverageTotal,
  upcomingShiftCount,
  upcomingShiftDays,
  todayStaffedShifts,
  recentActivity,
  pendingRequests,
  currentCycleStatus,
  currentCycleHasNoShifts = false,
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
  dataLoadIssueCount = 0,
}: ManagerTriageDashboardProps) {
  const isLoading =
    isLoadingValue(todayCoverageCovered) ||
    isLoadingValue(todayCoverageTotal) ||
    isLoadingValue(upcomingShiftCount) ||
    isLoadingValue(pendingRequests) ||
    isLoadingValue(needsReviewCount)
  const coverageIssueCount: number | '--' =
    isLoadingValue(todayCoverageCovered) || isLoadingValue(todayCoverageTotal)
      ? '--'
      : Math.max(todayCoverageTotal - todayCoverageCovered, 0)
  const openAssignmentCount: number | '--' =
    isLoadingValue(dayShiftsFilled) ||
    isLoadingValue(dayShiftsTotal) ||
    isLoadingValue(nightShiftsFilled) ||
    isLoadingValue(nightShiftsTotal)
      ? '--'
      : Math.max(dayShiftsTotal - dayShiftsFilled, 0) +
        Math.max(nightShiftsTotal - nightShiftsFilled, 0)
  const todayShiftSummaries = buildTodayShiftSummaries(todayStaffedShifts)
  const missingLeadCount = todayShiftSummaries.filter((shift) => !shift.lead).length
  const cycleSteps = getCycleStepState({
    currentCycleStatus,
    currentCycleHasNoShifts,
    needsReviewCount,
    nextCycleLabel,
  })
  const managerChecklistSteps = getManagerChecklistSteps({
    coverageIssueCount,
    openAssignmentCount,
    needsReviewCount,
    needsReviewDetail,
    nextCycleLabel,
    nextCycleDetail,
    currentCycleStatus,
    currentCycleDetail,
  })

  const attentionItems: AttentionItem[] = [
    {
      key: 'approvals',
      count: pendingRequests,
      label:
        pendingRequests === '--'
          ? LOADING_LABEL
          : `${pluralize(pendingRequests, 'approval')} waiting`,
      detail: 'Requests need manager review.',
      href: approvalsHref,
      action: 'Review requests',
      icon: <FileCheck className="h-4 w-4" aria-hidden="true" />,
      tone:
        pendingRequests !== '--' && pendingRequests > 0 ? ('warning' as const) : ('muted' as const),
      show: pendingRequests === '--' || pendingRequests > 0,
    },
    {
      key: 'open-shifts',
      count: openAssignmentCount,
      label:
        openAssignmentCount === '--'
          ? LOADING_LABEL
          : `${pluralize(openAssignmentCount, 'open shift')} in this Schedule Block`,
      detail: 'Unassigned schedule rows still need owners.',
      href: scheduleHref,
      action: 'Fill open shifts',
      icon: <Users className="h-4 w-4" aria-hidden="true" />,
      tone:
        openAssignmentCount !== '--' && openAssignmentCount > 0
          ? ('warning' as const)
          : ('muted' as const),
      show: openAssignmentCount === '--' || openAssignmentCount > 0,
    },
    {
      key: 'coverage',
      count: coverageIssueCount,
      label:
        coverageIssueCount === '--'
          ? LOADING_LABEL
          : `${pluralize(coverageIssueCount, 'coverage safety issue')}`,
      detail:
        coverageIssueCount === 0
          ? 'Today is fully covered.'
          : 'Today has coverage that needs review.',
      href: scheduleHref,
      action: 'View schedule',
      icon: <Shield className="h-4 w-4" aria-hidden="true" />,
      tone:
        coverageIssueCount !== '--' && coverageIssueCount > 0
          ? ('danger' as const)
          : ('success' as const),
      show: coverageIssueCount === '--' || coverageIssueCount > 0,
    },
    {
      key: 'leads',
      count: missingLeadCount,
      label: `${pluralize(missingLeadCount, 'shift')} missing a lead today`,
      detail: 'Day and night shift should each have a visible lead.',
      href: scheduleHref,
      action: 'Assign leads',
      icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
      tone: 'warning' as const,
      show: missingLeadCount > 0,
    },
    {
      key: 'review',
      count: needsReviewCount,
      label:
        needsReviewCount === '--'
          ? LOADING_LABEL
          : `${pluralize(needsReviewCount, 'review item')} waiting`,
      detail: needsReviewCount === 0 ? 'No review queue items.' : needsReviewDetail,
      href: reviewHref,
      action: 'Review updates',
      icon: <ListChecks className="h-4 w-4" aria-hidden="true" />,
      tone:
        needsReviewCount !== '--' && needsReviewCount > 0
          ? ('warning' as const)
          : ('success' as const),
      show: needsReviewCount === '--' || needsReviewCount > 0,
    },
  ]
    .filter((item) => item.show)
    .sort((left, right) => getAttentionPriority(right) - getAttentionPriority(left))
  const primaryAttention = attentionItems[0] ?? null
  const primaryAttentionProps = primaryAttention
    ? {
        count: primaryAttention.count,
        label: primaryAttention.label,
        detail: primaryAttention.detail,
        href: primaryAttention.href,
        action: primaryAttention.action,
        icon: primaryAttention.icon,
        tone: primaryAttention.tone,
      }
    : null
  const secondaryAttentionItems = attentionItems.slice(1)

  const exceptionRows = [
    ...upcomingShiftDays.map((item) => ({
      label: item.label,
      detail: `${pluralize(item.count, 'open shift')}`,
      href: scheduleHref,
    })),
    ...(pendingRequests !== '--' && pendingRequests > 0
      ? [
          {
            label: 'Requests queue',
            detail: `${pluralize(pendingRequests, 'approval')} affecting schedule changes`,
            href: approvalsHref,
          },
        ]
      : []),
    ...(coverageIssueCount !== '--' && coverageIssueCount > 0
      ? [
          {
            label: 'Today',
            detail: `${pluralize(coverageIssueCount, 'coverage issue')} needs review`,
            href: scheduleHref,
          },
        ]
      : []),
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-5 md:py-6 xl:px-7">
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
          Manager Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What needs to be fixed or approved right now.
        </p>
      </div>

      <section
        className="grid gap-2 rounded-lg border border-border bg-card px-3 py-3 shadow-tw-2xs md:grid-cols-4"
        aria-label="Schedule context"
      >
        <ContextCell
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
          label="Schedule scope"
          value="Current site"
        />
        <ContextCell
          icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
          label="Schedule Block"
          value={activeCycleDateRange ?? 'Current Schedule Block'}
        />
        <ContextCell
          icon={<Sun className="h-4 w-4" aria-hidden="true" />}
          label="Shift context"
          value="Day / Night / Both"
        />
        <ContextCell
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          label="Schedule status"
          value={currentCycleStatus}
        />
      </section>

      {dataLoadIssueCount > 0 ? (
        <section
          aria-label="Dashboard data warning"
          className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)]/55 px-4 py-3 text-sm text-[var(--warning-text)]"
        >
          <p className="font-bold">Some dashboard details could not load.</p>
          <p className="mt-1">
            Use Schedule as the final staffing source, then refresh this dashboard when you have a
            moment.
          </p>
        </section>
      ) : null}

      <section
        className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)]/55 p-4 shadow-tw-ring-attention"
        aria-label="Needs your attention"
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Needs your attention</h2>
            <p className="text-sm text-muted-foreground">Approvals, gaps, and publish blockers.</p>
          </div>
          {primaryAttention ? (
            <Button
              className="min-h-10 bg-[var(--warning)] text-accent-foreground hover:brightness-105"
              asChild
            >
              <Link href={primaryAttention.href}>
                {primaryAttention.action}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
        {primaryAttentionProps ? (
          <PrimaryAttentionItem {...primaryAttentionProps} />
        ) : (
          <AllClearAttention href={scheduleHref} />
        )}
        {secondaryAttentionItems.length > 0 ? (
          <div className="mt-2 grid gap-2 lg:grid-cols-3">
            {secondaryAttentionItems.map((item, index) => {
              const { key, ...attentionItem } = item
              return (
                <AttentionRow
                  key={key}
                  priorityLabel={`Priority ${index + 2}`}
                  {...attentionItem}
                />
              )
            })}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-tw-sm">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Manager checklist</h2>
            <p className="text-sm text-muted-foreground">
              Start with the first item that needs attention. Everything else can wait.
            </p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            Calm review order for today
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {managerChecklistSteps.map((step, index) => (
            <ChecklistStep key={step.label} index={index + 1} {...step} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
        <Card className="rounded-lg border-border/70 bg-card shadow-tw-float-tight">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold text-foreground">
              Today&apos;s staffing
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 pb-4 md:grid-cols-2">
            {todayShiftSummaries.map((shift) => (
              <TodayShiftCard key={shift.key} shift={shift} />
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-lg border-border/70 bg-card shadow-tw-float-tight">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold text-foreground">
              Current Schedule Block
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Next deadline
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {nextCycleLabel === 'No next Schedule Block' ? currentCycleDetail : nextCycleLabel}
              </p>
              <p className="text-xs text-muted-foreground">{nextCycleDetail}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {cycleSteps.map((step) => (
                <CycleStepBadge key={step.label} {...step} />
              ))}
            </div>
            {currentCycleStatus !== 'Published' ? (
              <Button variant="outline" size="sm" className="min-h-10 w-full" asChild>
                <Link href={currentCycleCtaHref ?? scheduleHref}>
                  Continue Schedule Block
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
            {nextCycleCtaHref ? (
              <Button variant="outline" size="sm" className="min-h-10 w-full" asChild>
                <Link href={nextCycleCtaHref}>
                  Plan next Schedule Block
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {exceptionRows.length > 0 ? (
        <Card className="rounded-lg border-border/70 bg-card shadow-tw-float-tight">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold text-foreground">Upcoming exceptions</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/70 pb-4">
            {exceptionRows.map((item) => (
              <ExceptionRow key={`${item.label}-${item.detail}`} {...item} />
            ))}
            {openAssignmentCount !== '--' && openAssignmentCount > 0 ? (
              <ExceptionRow
                label="Open assignments"
                detail={`${pluralize(openAssignmentCount, 'open shift')} still need owners.`}
                href={scheduleHref}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {recentActivity.length > 0 ? (
        <Card className="rounded-lg border-border/70 bg-card shadow-tw-float-tight">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl font-bold text-foreground">Recent activity</CardTitle>
            <Button variant="ghost" size="sm" className="min-h-10 px-0 text-xs" asChild>
              <Link href="/notifications">
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-border/70 pb-4">
            {recentActivity.slice(0, 5).map((item, index) => (
              <Link
                key={`${item.title}-${index}`}
                href={item.href}
                className="flex min-h-12 items-center justify-between gap-3 py-2 text-foreground hover:no-underline"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.timeLabel}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <p className="sr-only">{LOADING_LABEL}</p>
      ) : null}
    </div>
  )
}

function ChecklistStep({
  index,
  label,
  value,
  detail,
  tone,
}: {
  index: number
  label: string
  value: string
  detail: string
  tone: 'success' | 'warning' | 'muted'
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-3',
        tone === 'success'
          ? 'border-[var(--success-border)] bg-[var(--success-subtle)]/45'
          : tone === 'warning'
            ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)]/55'
            : 'border-border bg-muted/25'
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-black tabular-nums',
            tone === 'success'
              ? 'border-[var(--success-border)] bg-background text-[var(--success-text)]'
              : tone === 'warning'
                ? 'border-[var(--warning-border)] bg-background text-[var(--warning-text)]'
                : 'border-border bg-background text-muted-foreground'
          )}
        >
          {index}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{label}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  )
}

function PrimaryAttentionItem({
  count,
  label,
  detail,
  href,
  action,
  icon,
  tone,
}: Omit<AttentionItem, 'key' | 'show'>) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-card p-4 text-foreground shadow-tw-md hover:bg-background hover:no-underline sm:flex-row sm:items-center sm:justify-between',
        tone === 'danger'
          ? 'border-[var(--error-border)]'
          : tone === 'warning'
            ? 'border-[var(--warning-border)]'
            : tone === 'success'
              ? 'border-[var(--success-border)]'
              : 'border-border/70'
      )}
    >
      <span className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
            tone === 'danger'
              ? 'bg-[var(--error-subtle)] text-[var(--error-text)]'
              : tone === 'warning'
                ? 'bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                : tone === 'success'
                  ? 'bg-[var(--success-subtle)] text-[var(--success-text)]'
                  : 'bg-muted text-muted-foreground'
          )}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Priority 1 - Top priority
          </span>
          <span className="mt-1 block text-2xl font-bold leading-tight text-foreground tabular-nums">
            {count === '--' ? LOADING_LABEL : label}
          </span>
          {count !== '--' ? (
            <span className="mt-1 block text-sm leading-5 text-muted-foreground">{detail}</span>
          ) : null}
        </span>
      </span>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        {action}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </Link>
  )
}

function AllClearAttention({ href }: { href: string }) {
  return (
    <div className="rounded-lg border border-[var(--success-border)] bg-card p-4 shadow-tw-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--success-subtle)] text-[var(--success-text)]">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              All clear for now
            </span>
            <span className="mt-1 block text-2xl font-bold leading-tight text-foreground">
              No urgent manager actions are showing.
            </span>
            <span className="mt-1 block text-sm leading-5 text-muted-foreground">
              Check staffing and the next Schedule Block when you have time.
            </span>
          </span>
        </span>
        <Button variant="outline" size="sm" className="min-h-10" asChild>
          <Link href={href}>
            View schedule
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function ContextCell({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/35 px-3 py-2">
      <span className="shrink-0 text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}

function AttentionRow({
  priorityLabel,
  count,
  label,
  detail,
  href,
  action,
  icon,
  tone,
}: {
  priorityLabel: string
  count: number | '--'
  label: string
  detail: string
  href: string
  action: string
  icon: ReactNode
  tone: 'danger' | 'warning' | 'success' | 'muted'
  show?: boolean
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[6.5rem] flex-col justify-between rounded-lg border border-border/70 bg-card p-3 text-foreground shadow-tw-2xs hover:bg-background hover:no-underline"
    >
      <span className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            tone === 'danger'
              ? 'bg-[var(--error-subtle)] text-[var(--error-text)]'
              : tone === 'warning'
                ? 'bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                : tone === 'success'
                  ? 'bg-[var(--success-subtle)] text-[var(--success-text)]'
                  : 'bg-muted text-muted-foreground'
          )}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {priorityLabel}
          </span>
          <span className="block text-lg font-bold leading-tight text-foreground tabular-nums">
            {count === '--' ? LOADING_LABEL : label}
          </span>
          {count !== '--' ? (
            <span className="mt-1 block text-sm leading-5 text-muted-foreground">{detail}</span>
          ) : null}
        </span>
      </span>
      <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
        {action}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </Link>
  )
}

function TodayShiftCard({ shift }: { shift: ShiftSummary }) {
  const needsAttention = shift.openCount > 0 || !shift.lead
  const Icon = shift.key === 'day' ? Sun : Moon

  return (
    <article className="rounded-lg border border-border/70 bg-background px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <h3 className="text-base font-bold text-foreground">{shift.label}</h3>
        </div>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
            needsAttention
              ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
              : 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
          )}
        >
          {needsAttention ? 'Needs attention' : 'Good'}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Lead: </span>
          {shift.lead ? (
            <span className="rounded-md bg-[var(--info-subtle)] px-2 py-1 font-bold text-[var(--info-text)]">
              {shift.lead}
            </span>
          ) : (
            <span className="font-semibold text-[var(--warning-text)]">Missing</span>
          )}
        </p>
        <p className="leading-6">
          <span className="text-muted-foreground">Working: </span>
          <span className="font-medium text-foreground">
            {shift.staff.length > 0 ? shift.staff.join(', ') : 'No staffed names'}
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">Open: </span>
          <span
            className={cn(
              'font-bold tabular-nums',
              shift.openCount > 0 ? 'text-[var(--warning-text)]' : 'text-[var(--success-text)]'
            )}
          >
            {shift.openCount}
          </span>
        </p>
      </div>
    </article>
  )
}

function CycleStepBadge({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'success' | 'warning' | 'muted'
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2',
        tone === 'success'
          ? 'border-[var(--success-border)] bg-[var(--success-subtle)]/50'
          : tone === 'warning'
            ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)]/60'
            : 'border-border bg-muted/30'
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function ExceptionRow({ label, detail, href }: { label: string; detail: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center justify-between gap-3 py-2 text-foreground hover:no-underline"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="block truncate text-sm text-muted-foreground">{detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
    </Link>
  )
}
