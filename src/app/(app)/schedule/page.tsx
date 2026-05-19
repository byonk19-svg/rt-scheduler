import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { ScheduleGrid } from '@/components/schedule-grid/ScheduleGrid'
import { generateDraftScheduleAction } from '@/app/(app)/schedule/actions/draft-actions'
import { toggleCyclePublishedAction } from '@/app/(app)/schedule/actions/publish-actions'

import { loadScheduleGridData } from './schedule-grid-data'

export const metadata: Metadata = {
  title: 'Team Schedule',
  description: 'Review staffing, coverage, and publish readiness from the unified schedule grid.',
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
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card px-6 py-8 text-center shadow-sm">
          <p className="text-base font-semibold text-foreground">
            No Schedule Block is available yet.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Managers need to create or publish a Schedule Block before this view has shifts to show.
            Staff will see their Team Schedule here after a block is published.
          </p>
          <p className="mt-4 text-xs font-medium text-muted-foreground">
            Check with the manager if you expected a live schedule.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-6 pt-3 md:px-6 md:pt-4">
      <ManagerWorkspaceHeader
        title="Team Schedule"
        subtitle="Draft staffing, coverage review, and live schedule visibility."
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
