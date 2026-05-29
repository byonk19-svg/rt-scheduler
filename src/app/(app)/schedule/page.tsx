import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { ScheduleGrid } from '@/components/schedule-grid/ScheduleGrid'
import { Button } from '@/components/ui/button'
import type { GridDataset } from '@/components/schedule-grid/schedule-grid-types'
import { generateDraftScheduleAction } from '@/app/(app)/schedule/actions/draft-actions'
import { sendPreliminaryScheduleAction } from '@/app/(app)/schedule/actions/preliminary-actions'
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
  switch (dataset.interactionMode.kind) {
    case 'manager_edit':
      return 'Manager edit'
    case 'lead_status':
      return 'Lead status updates'
    case 'staff_view':
    case 'combined_readonly':
      return 'Read-only'
  }
}

function getScheduleSubtitle(dataset: GridDataset) {
  if (dataset.interactionMode.kind === 'manager_edit') {
    return 'Draft staffing, coverage review, and live schedule visibility.'
  }
  if (dataset.interactionMode.kind === 'lead_status') {
    return 'Review the team schedule and update published shift status in one 42-day grid.'
  }
  return 'Review your row and the live team schedule in one 42-day grid.'
}

function getSetupParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getScheduleFeedback(params: Record<string, string | string[] | undefined>) {
  const success = getSetupParam(params.success)
  const error = getSetupParam(params.error)
  const violations = getSetupParam(params.violations)
  const under = getSetupParam(params.under)
  const over = getSetupParam(params.over)
  const missingAvailability = getSetupParam(params.missing_availability)

  if (success === 'preliminary_sent') {
    return {
      tone: 'success' as const,
      text: 'Preliminary schedule sent. Staff can review tentative assignments from Preliminary.',
    }
  }
  if (success === 'preliminary_refreshed') {
    return {
      tone: 'success' as const,
      text: 'Preliminary schedule refreshed with the latest draft assignments.',
    }
  }
  if (success === 'cycle_published') {
    return {
      tone: 'success' as const,
      text: 'Schedule Block published and publish email processing started.',
    }
  }
  if (!error) return null

  const copy: Record<string, string> = {
    publish_weekly_rule_violation: `Publish blocked: ${violations ?? 'some'} weekly staffing rule ${
      violations === '1' ? 'violation needs' : 'violations need'
    } review (${under ?? '0'} under, ${over ?? '0'} over). Adjust assignments or use an approved override path before final publish.`,
    publish_shift_rule_violation:
      'Publish blocked: resolve coverage or lead staffing issues before final publish.',
    publish_availability_rule_violation:
      'Publish blocked: resolve Need Off or Need to Work conflicts before final publish.',
    publish_missing_availability_warning: `Publish paused: ${missingAvailability ?? 'some'} staff ${
      missingAvailability === '1' ? 'member is' : 'members are'
    } missing availability. Review the gap, then use Publish with missing availability to continue.`,
    publish_unresolved_preliminary_marks:
      'Publish blocked: resolve preliminary schedule marks before final publish.',
    publish_unresolved_preliminary_requests:
      'Publish blocked: resolve preliminary requests before final publish.',
    preliminary_send_failed:
      'Could not send the preliminary schedule. Review the draft and try again.',
    preliminary_cycle_archived: 'Archived Schedule Blocks cannot be sent to preliminary review.',
    preliminary_cycle_published: 'Published Schedule Blocks cannot be sent to preliminary review.',
  }

  return {
    tone: 'error' as const,
    text: copy[error] ?? 'Schedule action failed. Refresh and try again.',
  }
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
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/schedule/planning">Plan Schedule Block</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Manager action required: set up or publish the next Schedule Block.
          </p>
        </section>
      </div>
    )
  }

  if (result.status === 'load_error') {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-12 md:px-6">
        {showSetupCompleteBanner ? <SetupCompleteBanner /> : null}
        <section className="mx-auto max-w-md rounded-xl border border-border/70 bg-card px-6 py-8 text-center shadow-tw-sm">
          <p className="text-base font-semibold text-foreground">Could not load Team Schedule.</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Refresh this page. If this keeps happening, contact an administrator.
          </p>
        </section>
      </div>
    )
  }

  const feedback = getScheduleFeedback(params)

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
      {feedback ? (
        <div
          className={
            feedback.tone === 'success'
              ? 'rounded-lg border border-[var(--success-border)] bg-[var(--success-subtle)] px-4 py-3 text-sm font-medium text-[var(--success-text)]'
              : 'rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-text)]'
          }
        >
          {feedback.text}
        </div>
      ) : null}
      <ScheduleGrid
        key={`${result.dataset.cycleId}:${result.dataset.shiftType}`}
        initialDataset={result.dataset}
        initialShiftTab={result.initialShiftTab}
        autoDraftAction={
          result.dataset.interactionMode.canUseManagerToolbar
            ? generateDraftScheduleAction
            : undefined
        }
        preliminaryAction={
          result.dataset.interactionMode.canUseManagerToolbar
            ? sendPreliminaryScheduleAction
            : undefined
        }
        publishAction={
          result.dataset.interactionMode.canUseManagerToolbar
            ? toggleCyclePublishedAction
            : undefined
        }
        preFlightSummary={result.preFlightSummary}
      />
    </div>
  )
}
