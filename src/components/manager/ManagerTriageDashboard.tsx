import Link from 'next/link'
import { ArrowRight, CalendarDays, Clock3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
  const now = new Date()
  const calendar = buildMonthGrid(now)
  const coveragePercent = getCoveragePercent(todayCoverageCovered, todayCoverageTotal)
  const coverageCountLabel =
    todayCoverageCovered === '--' || todayCoverageTotal === '--'
      ? LOADING_LABEL
      : `${todayCoverageCovered} of ${todayCoverageTotal} shifts`

  const pendingRequestLabel =
    pendingRequests === '--'
      ? LOADING_LABEL
      : pendingRequests === 1
        ? '1 pending request'
        : `${pendingRequests} pending requests`

  const approvalsWaitingLabel =
    approvalsWaiting === '--'
      ? LOADING_LABEL
      : approvalsWaiting === 1
        ? '1 waiting'
        : `${approvalsWaiting} waiting`

  return (
    <div className="max-w-[1120px] px-5 py-5 xl:px-7">
      <div className="mb-4">
        <h1 className="text-[1.8rem] font-semibold tracking-tight text-foreground">
          Manager inbox
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Triage approvals, cycle readiness, and review items in one place.
        </p>
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="gap-0 rounded-2xl border-border/70 bg-card py-0 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 pb-2 pt-3.5">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Today&apos;s Coverage
              </CardTitle>
              <span className="h-2 w-2 rounded-full bg-primary/80" />
            </CardHeader>
            <CardContent className="space-y-2.5 py-3.5">
              <p className="text-[2rem] font-semibold leading-none tracking-tight text-foreground">
                {coveragePercent === null ? '--' : `${coveragePercent}%`}
              </p>
              <p className="text-[11px] text-muted-foreground">{coverageCountLabel}</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${coveragePercent ?? 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-2xl border-border/70 bg-card py-0 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 pb-2 pt-3.5">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Upcoming Shifts
              </CardTitle>
              <span className="h-2 w-2 rounded-full bg-primary/80" />
            </CardHeader>
            <CardContent className="space-y-2.5 py-3.5">
              <p className="text-[2rem] font-semibold leading-none tracking-tight text-foreground">
                {upcomingShiftCount === '--' ? '--' : `${upcomingShiftCount}`}
              </p>
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                {upcomingShiftDays.length > 0 ? (
                  upcomingShiftDays.map((item) => (
                    <li key={item.label}>
                      {item.label}: {item.count} shifts
                    </li>
                  ))
                ) : (
                  <li>{LOADING_LABEL}</li>
                )}
              </ul>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-0 text-xs" asChild>
                <Link href={scheduleHref}>
                  Open schedule
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-2xl border-border/70 bg-card py-0 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 pb-2 pt-3.5">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Pending Requests
              </CardTitle>
              <span className="h-2 w-2 rounded-full bg-primary/80" />
            </CardHeader>
            <CardContent className="space-y-2.5 py-3.5">
              <p className="text-[2rem] font-semibold leading-none tracking-tight text-foreground">
                {pendingRequests === '--' ? '--' : String(pendingRequests)}
              </p>
              <p className="text-[11px] text-muted-foreground">{pendingRequestLabel}</p>
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <Link href={approvalsHref}>Review all</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[2fr_1fr]">
          <Card className="gap-0 rounded-2xl border-border/70 bg-card py-0 shadow-none">
            <CardHeader className="border-b border-border/70 pb-2.5 pt-3.5">
              <CardTitle className="text-sm font-medium text-foreground">
                Schedule Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 py-3.5 md:grid-cols-2">
              <div>
                <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-foreground">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  {calendar.monthLabel}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label}>{label}</div>
                  ))}
                </div>
                <div className="mt-1 space-y-1">
                  {calendar.weeks.map((week, rowIndex) => (
                    <div key={`week-${rowIndex}`} className="grid grid-cols-7 gap-1">
                      {week.map((day, colIndex) => (
                        <div
                          key={`day-${rowIndex}-${colIndex}`}
                          className={`flex h-7 items-center justify-center rounded-md border text-xs ${
                            day === null
                              ? 'border-transparent text-transparent'
                              : day.isToday
                                ? 'border-primary/50 bg-primary/90 font-semibold text-primary-foreground'
                                : 'border-border/60 bg-muted/20 text-foreground'
                          }`}
                        >
                          {day?.day ?? ''}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Clock3 className="h-3.5 w-3.5 text-primary" />
                  Today&apos;s Active Shifts
                </div>
                <div className="space-y-2">
                  {todayActiveShifts.length > 0 ? (
                    todayActiveShifts.map((shift) => (
                      <div
                        key={`${shift.label}-${shift.detail}`}
                        className="rounded-md border border-border/70 bg-card px-3 py-2"
                      >
                        <p className="text-sm font-medium leading-tight text-foreground">
                          {shift.label}
                        </p>
                        <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
                          {shift.detail}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-md border border-border/70 bg-card px-3 py-2 text-xs text-muted-foreground">
                      {LOADING_LABEL}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Card className="gap-0 rounded-2xl border-border/70 bg-card py-0 shadow-none">
              <CardHeader className="border-b border-border/70 pb-2.5 pt-3.5">
                <CardTitle className="text-sm font-medium text-foreground">Manager Inbox</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5 py-3.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Current cycle
                  </p>
                  <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                    {currentCycleStatus}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{currentCycleDetail}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Next 6-week cycle
                  </p>
                  <p className="mt-1 text-sm font-semibold tracking-tight text-foreground">
                    {nextCycleLabel}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{nextCycleDetail}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Needs review
                  </p>
                  <p className="mt-1 text-[1.7rem] font-semibold leading-none tracking-tight text-foreground">
                    {needsReviewCount === '--' ? '--' : String(needsReviewCount)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{needsReviewDetail}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">{approvalsWaitingLabel}</p>
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-0 text-xs" asChild>
                  <Link href={reviewHref}>
                    Review updates
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="gap-0 rounded-2xl border-border/70 bg-card py-0 shadow-none">
              <CardHeader className="border-b border-border/70 pb-2.5 pt-3.5">
                <CardTitle className="text-sm font-medium text-foreground">
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 py-3.5">
                {recentActivity.length > 0 ? (
                  recentActivity.map((item, index) => (
                    <div key={`${item.title}-${index}`} className="flex gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
                      <div className="min-w-0">
                        <p className="text-xs leading-snug text-foreground">{item.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{item.timeLabel}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">{LOADING_LABEL}</p>
                )}
                <Button variant="ghost" size="sm" className="mt-1 h-7 gap-1 px-0 text-xs" asChild>
                  <Link href={reviewHref}>
                    View all
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function buildMonthGrid(baseDate: Date) {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: Array<{ day: number; isToday: boolean } | null> = []
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday =
      day === baseDate.getDate() && month === baseDate.getMonth() && year === baseDate.getFullYear()
    cells.push({ day, isToday })
  }
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  const weeks: Array<Array<{ day: number; isToday: boolean } | null>> = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return {
    monthLabel: baseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    weeks,
  }
}

function getCoveragePercent(covered: number | '--', total: number | '--') {
  if (covered === '--' || total === '--') return null
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((covered / total) * 100)))
}
