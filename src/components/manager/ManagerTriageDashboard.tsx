import Link from 'next/link'
import type { ReactNode } from 'react'
import { CalendarDays, Send } from 'lucide-react'

import { ManagerTriageMainPanel } from '@/components/manager/ManagerTriageMainPanel'
import { ManagerTriageSidebar } from '@/components/manager/ManagerTriageSidebar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

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
  needsReviewCount: number | '--'
  needsReviewDetail: string
  dayShiftsFilled: number | '--'
  dayShiftsTotal: number | '--'
  nightShiftsFilled: number | '--'
  nightShiftsTotal: number | '--'
  approvalsHref: string
  scheduleHomeHref: string
  scheduleHref: string
  reviewHref: string
  activeCycleDateRange?: string
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
  needsReviewCount,
  needsReviewDetail,
  dayShiftsFilled,
  dayShiftsTotal,
  nightShiftsFilled,
  nightShiftsTotal,
  approvalsHref,
  scheduleHomeHref,
  scheduleHref,
  reviewHref,
  activeCycleDateRange,
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

  return (
    <div className="max-w-[1120px] space-y-4 px-5 py-5 xl:px-7">
      <div className="relative overflow-hidden rounded-[26px] border border-border/70 bg-card p-5 shadow-tw-inbox-hero">
        <div className="relative flex flex-wrap items-start justify-between gap-3">
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
            <Button variant="outline" size="sm" className="min-h-11 px-4" asChild>
              <Link href={scheduleHomeHref}>
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                Open schedule
              </Link>
            </Button>
            <Button size="sm" className="min-h-11 px-4" asChild>
              <Link href={approvalsHref}>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Review approvals
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <ManagerTriageMainPanel
          approvalsHref={approvalsHref}
          dayShiftsFilled={dayShiftsFilled}
          dayShiftsTotal={dayShiftsTotal}
          isLoading={isLoading}
          nightShiftsFilled={nightShiftsFilled}
          nightShiftsTotal={nightShiftsTotal}
          pendingRequests={pendingRequests}
          recentActivity={recentActivity}
          scheduleHref={scheduleHref}
          todayActiveShifts={todayActiveShifts}
          todayCoverageCovered={todayCoverageCovered}
          todayCoverageTotal={todayCoverageTotal}
          upcomingShiftCount={upcomingShiftCount}
        />

        <ManagerTriageSidebar
          activeCycleDateRange={activeCycleDateRange}
          approvalsWaiting={approvalsWaiting}
          isLoading={isLoading}
          needsReviewCount={needsReviewCount}
          needsReviewDetail={needsReviewDetail}
          reviewHref={reviewHref}
          scheduleHomeHref={scheduleHomeHref}
          scheduleHref={scheduleHref}
          upcomingShiftDays={upcomingShiftDays}
        />
      </div>
    </div>
  )
}
