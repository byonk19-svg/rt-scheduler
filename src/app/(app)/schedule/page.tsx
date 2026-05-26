import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { ScheduleGrid } from '@/components/schedule-grid/ScheduleGrid'
import type { GridDataset } from '@/components/schedule-grid/schedule-grid-types'
import { generateDraftScheduleAction } from '@/app/(app)/schedule/actions/draft-actions'
import { toggleCyclePublishedAction } from '@/app/(app)/schedule/actions/publish-actions'

import { loadScheduleGridData } from './schedule-grid-data'
import { SetupCompleteBanner } from './SetupCompleteBanner'

export const metadata: Metadata = {
  title: 'Team Schedule',
  description: 'Review staffing, coverage, and publish readiness from the unified schedule grid.',
}

export const dynamic = 'force-dynamic'

type SchedulePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function ScheduleHeaderChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-tw-2xs">
      <span className="text-foreground">{label}</span>
      {` ${value}`}
    </span>
  )
}

function getScheduleAccessLabel(dataset: GridDataset) {
  if (dataset.canManageCoverage) return 'Manager edit'
  if (dataset.canUpdateAssignmentStatus) return 'Lead status updates'
  return 'Read-only'
}

function getScheduleSubtitle(dataset: GridDataset) {
  if (dataset.canManageCoverage) {
    return 'Draft staffing, coverage review, and live schedule visibility.'
  }
  if (dataset.canUpdateAssignmentStatus) {
    return 'Review the team schedule and update published shift status in one 42-day grid.'
  }
  return 'Review your row and the live team schedule in one 42-day grid.'
}

function getSetupParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const params = (await searchParams) ?? {}
  const showSetupCompleteBanner = getSetupParam(params.setup) === 'complete'
  const result = await loadScheduleGridData(params)

  if (result.status === 'unauthenticated') {
    redirect('/login')
  }

  if (result.status === 'forbidden') {
    redirect('/dashboard/staff')
  }

  if (result.status === 'no_cycle') {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-12 md:px-6">
        {showSetupCompleteBanner ? <SetupCompleteBanner /> : null}
        <section className="mx-auto max-w-md rounded-xl border border-border/70 bg-card px-6 py-8 text-center shadow-tw-sm">
          <p className="text-base font-semibold text-foreground">
            No active Schedule Block is available yet.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Managers can create or publish a Schedule Block before this view has shifts to show.
            Staff will see their Team Schedule here after a block is available.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[96rem] scroll-mt-24 space-y-4 px-4 pb-6 pt-2 md:px-6 md:pt-3">
      {showSetupCompleteBanner ? <SetupCompleteBanner /> : null}
      <ManagerWorkspaceHeader
        title="Team Schedule"
        subtitle={getScheduleSubtitle(result.dataset)}
        summary={
          <>
            <ScheduleHeaderChip label="Block" value={result.dataset.cycleDateRangeLabel} />
            <ScheduleHeaderChip
              label="State"
              value={result.dataset.isPublished ? 'Published' : 'Draft'}
            />
            <ScheduleHeaderChip label="Access" value={getScheduleAccessLabel(result.dataset)} />
          </>
        }
        compact
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
