import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { ScheduleGrid } from '@/components/schedule-grid/ScheduleGrid'
import { generateDraftScheduleAction } from '@/app/(app)/schedule/actions/draft-actions'
import { toggleCyclePublishedAction } from '@/app/(app)/schedule/actions/publish-actions'

import { loadScheduleGridData } from './schedule-grid-data'

export const metadata: Metadata = {
  title: 'Schedule',
  description: 'Review and manage the unified respiratory therapy schedule grid.',
}

export const dynamic = 'force-dynamic'

type SchedulePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const params = (await searchParams) ?? {}
  const result = await loadScheduleGridData(params)

  if (result.status === 'unauthenticated') {
    redirect('/login')
  }

  if (result.status === 'forbidden') {
    redirect('/dashboard/staff')
  }

  if (result.status === 'no_cycle') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center md:px-6">
        <p className="text-sm font-medium text-muted-foreground">
          No active Schedule Block is available yet.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <ManagerWorkspaceHeader
        title="Schedule"
        subtitle="One grid for draft staffing, live status, and team visibility."
      />
      <ScheduleGrid
        key={`${result.dataset.cycleId}:${result.dataset.shiftType}`}
        initialDataset={result.dataset}
        initialShiftTab={result.initialShiftTab}
        autoDraftAction={result.dataset.canManageCoverage ? generateDraftScheduleAction : undefined}
        publishAction={result.dataset.canManageCoverage ? toggleCyclePublishedAction : undefined}
        preFlightSummary={result.preFlightSummary}
      />
    </div>
  )
}
