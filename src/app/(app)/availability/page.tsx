import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Download, Plus } from 'lucide-react'

import { AvailabilityEntriesTable } from '@/app/availability/availability-requests-table'
import {
  copyAvailabilityFromPreviousCycleAction,
  deleteAvailabilityEntryAction,
  deleteManagerPlannerDateAction,
  saveManagerPlannerDatesAction,
} from '@/app/availability/actions'
import { AvailabilityPlannerFocusProvider } from '@/components/availability/availability-planner-focus-context'
import { AvailabilityOverviewHeader } from '@/components/availability/AvailabilityOverviewHeader'
import { ManagerSchedulingInputs } from '@/components/availability/ManagerSchedulingInputs'
import { AvailabilitySummaryChips } from '@/components/availability/availability-summary-chips'
import { FeedbackToast } from '@/components/feedback-toast'
import { MoreActionsMenu } from '@/components/more-actions-menu'
import { PrintMenuItem } from '@/components/print-menu-item'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import { getSearchParam } from '@/lib/availability-page-helpers'
import { loadManagerAvailabilityPageData } from '@/lib/availability-page-loaders'
import {
  buildAvailabilityHref as buildAvailabilityHrefShared,
  buildAvailabilityTabHref as buildAvailabilityTabHrefShared,
  getManagerAvailabilityFeedback,
  toAvailabilitySearchString,
  type AvailabilityRouteSearchParams,
} from '@/lib/availability-route-utils'
import { buildManagerAvailabilitySummaryChips } from '@/lib/availability-page-view-model'
import { toUiRole } from '@/lib/auth/roles'
import { formatHumanCycleRange } from '@/lib/calendar-utils'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Availability Planning',
}

type AvailabilityPageSearchParams = AvailabilityRouteSearchParams

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams?: Promise<AvailabilityPageSearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = searchParams ? await searchParams : undefined
  const feedback = getManagerAvailabilityFeedback(params)
  const initialStatus = getSearchParam(params?.status)
  const initialRoster = getSearchParam(params?.roster)

  if (getSearchParam(params?.tab) === 'intake') {
    redirect(`/availability/intake${toAvailabilitySearchString(params)}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = toUiRole(profile?.role)
  const canManageAvailability = can(role, 'access_manager_ui')

  if (!canManageAvailability) {
    redirect(`/therapist/availability${toAvailabilitySearchString(params)}`)
  }

  const {
    cycles,
    selectedCycle,
    selectedCycleId,
    activeTeamCount,
    intakeNeedsReviewCount,
    availabilityRows,
    plannerTherapists,
    plannerOverrides,
    plannerWorkPatterns,
    selectedPlannerTherapistId,
    initialFilters,
    defaultSecondaryTab,
    defaultSecondaryOpen,
    plannerTherapistNameForDefault,
    officiallySubmittedRows: officiallySubmittedAvailabilityRows,
    awaitingOfficialSubmissionRows,
    responseRosterSubmittedRows,
    responseRosterMissingRows,
  } = await loadManagerAvailabilityPageData({
    supabase: supabase as never,
    userId: user.id,
    searchParams: params,
  })

  const entriesCard = (
    <AvailabilityEntriesTable
      role={role}
      rows={availabilityRows}
      deleteAvailabilityEntryAction={deleteAvailabilityEntryAction}
      initialFilters={initialFilters}
      syncSearchFromPlannerFocus={canManageAvailability}
    />
  )

  const totalRequests = availabilityRows.length
  const needOffRequests = availabilityRows.filter((row) => row.entryType === 'force_off').length
  const availableToWorkRequests = availabilityRows.filter(
    (row) => row.entryType === 'force_on'
  ).length
  const uniqueRequesters = new Set(availabilityRows.map((row) => row.requestedBy)).size
  const responseRatio =
    activeTeamCount && activeTeamCount > 0 ? `${uniqueRequesters}/${activeTeamCount}` : null
  const plannerHref = buildAvailabilityTabHrefShared(params, 'planner')
  const intakeHref = `/availability/intake${toAvailabilitySearchString(params)}`
  const summaryChips = (
    <div className="space-y-2">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Use therapist responses and manager inputs to shape staffing before coverage is finalized.
      </p>
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Team totals for this cycle
      </p>
      <AvailabilitySummaryChips
        chips={buildManagerAvailabilitySummaryChips({
          awaitingOfficialSubmissionCount: awaitingOfficialSubmissionRows.length,
          officiallySubmittedCount: officiallySubmittedAvailabilityRows.length,
          needOffRequests,
          availableToWorkRequests,
          initialRoster,
          initialStatus,
          buildHref: (updates, hash) => buildAvailabilityHrefShared(params, updates, hash),
        })}
      />
    </div>
  )

  return (
    <div className="availability-page-print space-y-5">
      {feedback ? <FeedbackToast message={feedback.message} variant={feedback.variant} /> : null}

      <AvailabilityOverviewHeader
        title={canManageAvailability ? 'Availability planning' : 'Availability'}
        subtitle={
          selectedCycle
            ? formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)
            : 'No upcoming cycle selected'
        }
        totalRequests={totalRequests}
        needOffRequests={needOffRequests}
        availableToWorkRequests={availableToWorkRequests}
        responseRatio={responseRatio}
        summaryContent={summaryChips}
        actions={
          <>
            <Button
              asChild
              size="sm"
              className="gap-1.5 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            >
              <a
                href={
                  canManageAvailability
                    ? '#staff-scheduling-inputs'
                    : '#therapist-availability-workspace'
                }
              >
                <Plus className="h-3.5 w-3.5" />
                {canManageAvailability ? 'Plan coverage dates' : 'Add availability'}
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-border/80 bg-transparent text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Link href="/shift-board">Shift board</Link>
            </Button>
            <MoreActionsMenu
              label="Exports"
              triggerClassName="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border/80 bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
            >
              <a
                href="/api/availability/export"
                className="flex h-11 items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-secondary"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
              <PrintMenuItem />
            </MoreActionsMenu>
          </>
        }
      />

      <div className="border-b border-border/70">
        <nav className="-mb-px flex gap-0" aria-label="Availability sections">
          <a
            href={plannerHref}
            className={cn(
              'inline-flex h-11 items-center px-4 py-2 text-sm border-b-2 transition-colors border-primary text-foreground font-medium'
            )}
          >
            Planner
          </a>
          <a
            href={intakeHref}
            className={cn(
              'flex h-11 items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Email Intake
            {intakeNeedsReviewCount > 0 ? (
              <span className="rounded-full border border-warning-border bg-warning-subtle px-1.5 py-0.5 text-[10px] font-semibold text-warning-text">
                {intakeNeedsReviewCount}
              </span>
            ) : null}
          </a>
        </nav>
      </div>

      <AvailabilityPlannerFocusProvider
        initialFocusedTherapistName={plannerTherapistNameForDefault}
      >
        <ManagerSchedulingInputs
          cycles={cycles}
          therapists={plannerTherapists}
          overrides={plannerOverrides}
          workPatternsByTherapist={Object.fromEntries(plannerWorkPatterns.entries())}
          availabilityEntries={availabilityRows}
          initialCycleId={selectedCycleId}
          initialTherapistId={selectedPlannerTherapistId}
          submittedRows={responseRosterSubmittedRows}
          missingRows={responseRosterMissingRows}
          initialRosterFilter={
            initialRoster === 'all' ||
            initialRoster === 'submitted' ||
            initialRoster === 'has_requests'
              ? initialRoster
              : 'missing'
          }
          defaultSecondaryTab={defaultSecondaryTab}
          defaultSecondaryOpen={defaultSecondaryOpen}
          saveManagerPlannerDatesAction={saveManagerPlannerDatesAction}
          deleteManagerPlannerDateAction={deleteManagerPlannerDateAction}
          copyAvailabilityFromPreviousCycleAction={copyAvailabilityFromPreviousCycleAction}
          reviewRequestsPanel={<div id="availability-request-inbox">{entriesCard}</div>}
        />
      </AvailabilityPlannerFocusProvider>
    </div>
  )
}
