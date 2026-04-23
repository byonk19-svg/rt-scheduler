import Link from 'next/link'
import { CalendarDays, Sparkles } from 'lucide-react'

import { ManagerTriageActivityPanel } from '@/components/manager/ManagerTriageActivityPanel'
import { ManagerTriageMetricGrid } from '@/components/manager/ManagerTriageMetricGrid'
import { ScheduleProgress } from '@/components/manager/ScheduleProgress'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const LOADING_LABEL = 'Loading...'

export function ManagerTriageMainPanel({
  approvalsHref,
  dayShiftsFilled,
  dayShiftsTotal,
  isLoading,
  nightShiftsFilled,
  nightShiftsTotal,
  pendingRequests,
  recentActivity,
  scheduleHref,
  todayActiveShifts,
  todayCoverageCovered,
  todayCoverageTotal,
  upcomingShiftCount,
}: {
  approvalsHref: string
  dayShiftsFilled: number | '--'
  dayShiftsTotal: number | '--'
  isLoading: boolean
  nightShiftsFilled: number | '--'
  nightShiftsTotal: number | '--'
  pendingRequests: number | '--'
  recentActivity: Array<{ title: string; timeLabel: string; href: string }>
  scheduleHref: string
  todayActiveShifts: Array<{ label: string; detail: string }>
  todayCoverageCovered: number | '--'
  todayCoverageTotal: number | '--'
  upcomingShiftCount: number | '--'
}) {
  return (
    <div className="space-y-4">
      <ManagerTriageMetricGrid
        approvalsHref={approvalsHref}
        pendingRequests={pendingRequests}
        scheduleHref={scheduleHref}
        todayCoverageCovered={todayCoverageCovered}
        todayCoverageTotal={todayCoverageTotal}
        upcomingShiftCount={upcomingShiftCount}
      />

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
                  Auto-draft fills the day and night grids based on availability constraints. Takes
                  about 30 seconds.
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

      <ManagerTriageActivityPanel
        isLoading={isLoading}
        recentActivity={recentActivity}
        scheduleHref={scheduleHref}
        todayActiveShifts={todayActiveShifts}
      />
    </div>
  )
}
