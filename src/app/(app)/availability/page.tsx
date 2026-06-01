import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Download } from 'lucide-react'

import {
  copyAvailabilityFromPreviousCycleAction,
  saveManagerPlannerDatesAction,
} from '@/app/(app)/availability/manager-planner-actions'
import {
  closeAvailabilityWindowAction,
  reopenAvailabilityWindowAction,
} from '@/app/(app)/availability/actions'
import { saveManagerAvailabilityRequestsAction } from '@/app/(app)/availability/manager-request-actions'
import { AvailabilityPlannerFocusProvider } from '@/components/availability/availability-planner-focus-context'
import { FeedbackToast } from '@/components/feedback-toast'
import { MoreActionsMenu } from '@/components/more-actions-menu'
import { PrintMenuItem } from '@/components/print-menu-item'
import { can } from '@/lib/auth/can'
import { resolveAvailabilityWindowState } from '@/lib/availability-window'
import { buildMissingAvailabilityRows } from '@/lib/employee-directory'
import { parseRole } from '@/lib/auth/roles'
import { formatHumanCycleRange } from '@/lib/calendar-utils'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Availability Manager',
  description:
    'Review therapist responses, follow up on missing availability, and edit Schedule Block availability on behalf of staff.',
}

const ManagerSchedulingInputs = dynamic(() =>
  import('@/components/availability/ManagerSchedulingInputs').then(
    (module) => module.ManagerSchedulingInputs ?? (() => null)
  )
)

type ToastVariant = 'success' | 'error'
type AvailabilityOverrideType = 'force_off' | 'force_on'
type AvailabilityShiftType = 'day' | 'night' | 'both'

type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
  archived_at?: string | null
  availability_due_at?: string | null
  availability_closed_at?: string | null
  availability_reopened_at?: string | null
  status?: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
}

type AvailabilityRow = {
  id: string
  date: string
  shift_type: AvailabilityShiftType
  override_type: AvailabilityOverrideType
  note: string | null
  created_by: string | null
  created_at: string
  updated_at?: string | null
  source?: 'therapist' | 'manager' | null
  intent?:
    | 'therapist_need_off'
    | 'therapist_wants_work'
    | 'manager_block'
    | 'manager_force'
    | 'email_intake'
    | null
  therapist_id: string
  cycle_id: string
  profiles: { full_name: string } | { full_name: string }[] | null
  schedule_cycles:
    | { label: string; start_date: string; end_date: string }
    | { label: string; start_date: string; end_date: string }[]
    | null
}

type ManagerPlannerTherapistRow = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  employment_type: 'full_time' | 'part_time' | 'prn'
}

type ManagerPlannerOverrideRow = {
  id: string
  therapist_id: string
  cycle_id: string
  date: string
  shift_type: AvailabilityShiftType
  override_type: AvailabilityOverrideType
  note: string | null
  source: 'manager' | 'therapist'
  intent?:
    | 'therapist_need_off'
    | 'therapist_wants_work'
    | 'manager_block'
    | 'manager_force'
    | 'email_intake'
    | null
}

type AvailabilityPageSearchParams = {
  cycle?: string | string[]
  copied?: string | string[]
  error?: string | string[]
  success?: string | string[]
  tab?: string | string[]
  search?: string | string[]
  therapist?: string | string[]
  roster?: string | string[]
  status?: string | string[]
  startDate?: string | string[]
  endDate?: string | string[]
  sort?: string | string[]
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function toSearchString(params?: AvailabilityPageSearchParams): string {
  if (!params) return ''

  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, item)
      }
      continue
    }
    searchParams.set(key, value)
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

function getAvailabilityFeedback(params?: AvailabilityPageSearchParams): {
  message: string
  variant: ToastVariant
} | null {
  const error = getSearchParam(params?.error)
  const success = getSearchParam(params?.success)

  if (error === 'duplicate_entry') {
    return {
      message:
        'You already had an availability request for that date and shift in this Schedule Block. We updated it.',
      variant: 'success',
    }
  }

  if (error === 'submit_failed') {
    return {
      message: "Couldn't save availability. Try again.",
      variant: 'error',
    }
  }
  if (error === 'availability_conflict') {
    return {
      message:
        'That date already has manager-entered availability. Remove the existing entry before saving a different response.',
      variant: 'error',
    }
  }
  if (error === 'submission_closed') {
    return {
      message: 'Availability changes are closed for this Schedule Block.',
      variant: 'error',
    }
  }
  if (success === 'entry_submitted') {
    return {
      message: 'Availability submitted for this Schedule Block.',
      variant: 'success',
    }
  }

  if (success === 'draft_saved') {
    return {
      message: "Draft saved. Submit availability when you're ready.",
      variant: 'success',
    }
  }

  if (success === 'entry_deleted') {
    return {
      message: 'Availability request deleted.',
      variant: 'success',
    }
  }

  if (success === 'planner_saved') {
    return {
      message: 'Planner dates saved.',
      variant: 'success',
    }
  }

  if (success === 'manager_request_saved') {
    return {
      message: 'Availability saved for the selected therapist.',
      variant: 'success',
    }
  }

  if (success === 'planner_deleted') {
    return {
      message: 'Saved staffing date removed.',
      variant: 'success',
    }
  }

  if (success === 'manager_request_deleted') {
    return {
      message: 'Availability request removed from this Schedule Block.',
      variant: 'success',
    }
  }

  if (success === 'availability_closed') {
    return {
      message: 'Availability locked for this Schedule Block.',
      variant: 'success',
    }
  }

  if (success === 'availability_reopened') {
    return {
      message:
        'Availability reopened. Draft schedules will not update until a manager reviews changes.',
      variant: 'success',
    }
  }

  if (success === 'copy_success') {
    const count = getSearchParam(params?.copied)
    return {
      message: count
        ? `${count} date${Number(count) === 1 ? '' : 's'} copied from the previous Schedule Block.`
        : 'Availability copied from the previous Schedule Block.',
      variant: 'success',
    }
  }

  if (error === 'delete_failed') {
    return {
      message: "Couldn't delete that request. Try again.",
      variant: 'error',
    }
  }

  if (error === 'planner_save_failed') {
    return {
      message: "Couldn't save staffing dates. Try again.",
      variant: 'error',
    }
  }

  if (error === 'planner_availability_conflict') {
    return {
      message:
        'One or more selected dates already has therapist-submitted availability. Review the existing response before adding a staffing note.',
      variant: 'error',
    }
  }

  if (error === 'planner_delete_failed') {
    return {
      message: "Couldn't remove that date. Try again.",
      variant: 'error',
    }
  }

  if (error === 'manager_request_save_failed') {
    return {
      message: "Couldn't save that therapist availability request. Try again.",
      variant: 'error',
    }
  }

  if (error === 'manager_request_availability_conflict') {
    return {
      message:
        'One or more selected dates already has therapist-submitted availability. Remove the conflicting therapist entry before saving a manager-entered request.',
      variant: 'error',
    }
  }

  if (error === 'manager_request_delete_failed') {
    return {
      message: "Couldn't remove that therapist availability request. Try again.",
      variant: 'error',
    }
  }

  if (error === 'availability_window_failed') {
    return {
      message: "Couldn't update the availability window. Refresh and try again.",
      variant: 'error',
    }
  }
  if (error === 'availability_window_already_locked') {
    return {
      message: 'Availability is already locked for this Schedule Block.',
      variant: 'error',
    }
  }
  if (error === 'availability_window_not_locked') {
    return {
      message: 'Availability is not locked for this Schedule Block, so there is nothing to reopen.',
      variant: 'error',
    }
  }

  if (error === 'copy_no_source') {
    return {
      message:
        'Nothing to copy - this therapist has no saved dates in the previous Schedule Block.',
      variant: 'error',
    }
  }

  if (error === 'copy_nothing_new') {
    return {
      message:
        'All dates from the previous Schedule Block are already planned for this Schedule Block.',
      variant: 'error',
    }
  }

  if (error === 'copy_failed') {
    return {
      message: "Couldn't copy dates. Try again.",
      variant: 'error',
    }
  }

  if (success === 'email_intake_applied') {
    return {
      message: 'Intake dates applied to availability.',
      variant: 'success',
    }
  }

  if (success === 'email_intake_match_saved') {
    return {
      message: 'Matches saved. Apply dates when ready.',
      variant: 'success',
    }
  }

  if (error === 'email_intake_apply_failed') {
    return {
      message: "Couldn't apply this request. Review the matched dates first.",
      variant: 'error',
    }
  }

  if (error === 'email_intake_availability_conflict') {
    return {
      message:
        'This email includes dates that already have therapist-submitted availability. Review the existing response before applying the import.',
      variant: 'error',
    }
  }

  if (error === 'email_intake_match_failed') {
    return {
      message: "Couldn't save that match. Try again.",
      variant: 'error',
    }
  }

  return null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function AvailabilityManagerLoadError() {
  return (
    <div className="availability-page-print space-y-5">
      <section className="mx-auto max-w-md rounded-xl border border-border/70 bg-card px-6 py-8 text-center shadow-tw-sm">
        <p className="text-base font-semibold text-foreground">
          Could not load Availability Manager.
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Refresh this page. If this keeps happening, contact an administrator.
        </p>
      </section>
    </div>
  )
}

function availabilityLoadError(source: string, error: unknown) {
  console.error(`Could not load ${source}:`, error)
  return <AvailabilityManagerLoadError />
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams?: Promise<AvailabilityPageSearchParams>
}) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = searchParams ? await searchParams : undefined
  const feedback = getAvailabilityFeedback(params)
  const initialRoster = getSearchParam(params?.roster)
  if (getSearchParam(params?.tab) === 'intake') {
    redirect(`/availability/intake${toSearchString(params)}`)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at, site_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) return availabilityLoadError('availability manager profile', profileError)

  const canManageAvailability = can(parseRole(profile?.role), 'access_manager_ui', {
    isActive: profile?.is_active !== false,
    archivedAt: profile?.archived_at ?? null,
  })
  if (!canManageAvailability) {
    redirect(`/therapist/availability${toSearchString(params)}`)
  }
  if (!profile?.site_id) {
    return availabilityLoadError('availability manager site', { message: 'missing manager site' })
  }

  const { count: intakeReviewCount, error: intakeReviewCountError } = await supabase
    .from('availability_email_intake_items')
    .select('id', { count: 'exact', head: true })
    .eq('parse_status', 'needs_review')

  if (intakeReviewCountError) {
    console.warn('Could not load availability intake review count:', intakeReviewCountError)
  }

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`

  const { data: cyclesData, error: cyclesError } = await supabase
    .from('schedule_cycles')
    .select(
      'id, label, start_date, end_date, published, status, archived_at, availability_due_at, availability_closed_at, availability_reopened_at'
    )
    .is('archived_at', null)
    .eq('site_id', profile.site_id)
    .gte('end_date', todayKey)
    .order('start_date', { ascending: true })

  if (cyclesError) return availabilityLoadError('availability Schedule Blocks', cyclesError)

  const cycles = (cyclesData ?? []) as Cycle[]
  const selectedCycleIdFromParams = getSearchParam(params?.cycle)
  const selectedTherapistIdFromParams = getSearchParam(params?.therapist)
  const selectedCycle =
    cycles.find((cycle) => cycle.id === selectedCycleIdFromParams) ??
    cycles.find((cycle) => cycle.published === false) ??
    cycles[0] ??
    null
  const selectedCycleId = selectedCycle?.id ?? ''
  const draftScheduleResult = selectedCycleId
    ? await admin
        .from('shifts')
        .select('id', { count: 'exact', head: true })
        .eq('cycle_id', selectedCycleId)
        .limit(1)
    : { count: 0, error: null }

  if (draftScheduleResult.error) {
    return availabilityLoadError('availability window state', draftScheduleResult.error)
  }

  const availabilityWindow = resolveAvailabilityWindowState({
    cycle: selectedCycle,
    hasDraftSchedule: (draftScheduleResult.count ?? 0) > 0,
  })

  const entriesResult = selectedCycleId
    ? await supabase
        .from('availability_overrides')
        .select(
          'id, date, shift_type, override_type, note, created_by, created_at, updated_at, source, intent, therapist_id, cycle_id, profiles!availability_overrides_therapist_id_fkey(full_name), schedule_cycles(label, start_date, end_date)'
        )
        .order('date', { ascending: true })
        .order('created_at', { ascending: false })
        .eq('cycle_id', selectedCycleId)
    : { data: [], error: null }

  if (entriesResult.error) {
    return availabilityLoadError('availability overrides', entriesResult.error)
  }

  const entries = (entriesResult.data ?? []) as AvailabilityRow[]

  const plannerTherapistsResult = await supabase
    .from('profiles')
    .select('id, full_name, shift_type, employment_type')
    .in('role', ['therapist', 'lead'])
    .eq('is_active', true)
    .is('archived_at', null)
    .eq('site_id', profile.site_id)
    .order('full_name', { ascending: true })

  const plannerOverridesResult =
    cycles.length > 0
      ? await supabase
          .from('availability_overrides')
          .select(
            'id, therapist_id, cycle_id, date, shift_type, override_type, note, source, intent'
          )
          .eq('source', 'manager')
          .in(
            'cycle_id',
            cycles.map((cycle) => cycle.id)
          )
          .order('date', { ascending: true })
      : { data: [], error: null }

  if (plannerTherapistsResult.error) {
    return availabilityLoadError('active therapists and leads', plannerTherapistsResult.error)
  }
  if (plannerOverridesResult.error) {
    return availabilityLoadError(
      'manager availability planning assumptions',
      plannerOverridesResult.error
    )
  }

  const plannerTherapists = (plannerTherapistsResult.data ?? []) as ManagerPlannerTherapistRow[]
  const plannerOverrides = (plannerOverridesResult.data ?? []) as ManagerPlannerOverrideRow[]
  const intakeNeedsReviewCount = intakeReviewCount ?? 0

  const selectedPlannerTherapistId =
    plannerTherapists.find((therapist) => therapist.id === selectedTherapistIdFromParams)?.id ??
    plannerTherapists[0]?.id ??
    ''

  const { data: officialSubmissionRows, error: officialSubmissionRowsError } = selectedCycleId
    ? await supabase
        .from('therapist_availability_submissions')
        .select('therapist_id')
        .eq('schedule_cycle_id', selectedCycleId)
    : { data: [], error: null }

  if (officialSubmissionRowsError) {
    return availabilityLoadError('official availability submissions', officialSubmissionRowsError)
  }

  const officialSubmissionTherapistIds = new Set(
    (officialSubmissionRows ?? []).map((row) => (row as { therapist_id: string }).therapist_id)
  )

  const availabilityStatusRows = buildMissingAvailabilityRows(
    plannerTherapists.map((therapist) => ({
      id: therapist.id,
      full_name: therapist.full_name,
      is_active: true,
    })),
    entries.map((entry) => ({
      id: entry.id,
      therapist_id: entry.therapist_id,
      cycle_id: entry.cycle_id,
      date: entry.date,
      shift_type: entry.shift_type,
      override_type: entry.override_type,
      note: entry.note,
      created_at: entry.created_at,
      updated_at: entry.updated_at ?? entry.created_at,
      source: entry.source === 'manager' ? 'manager' : 'therapist',
      intent:
        entry.intent ??
        (entry.source === 'manager'
          ? entry.override_type === 'force_off'
            ? 'manager_block'
            : 'manager_force'
          : entry.override_type === 'force_off'
            ? 'therapist_need_off'
            : 'therapist_wants_work'),
    })),
    selectedCycleId,
    { officialSubmissionTherapistIds }
  )

  const submittedAvailabilityRows = availabilityStatusRows.filter((row) => row.submitted)
  const missingAvailabilityRows = availabilityStatusRows.filter((row) => !row.submitted)

  const plannerTherapistNameForDefault =
    plannerTherapists.find((therapist) => therapist.id === selectedPlannerTherapistId)?.full_name ??
    null

  const availabilityRows = entries.map((entry) => {
    const cycle = getOne(entry.schedule_cycles)
    const requester = getOne(entry.profiles)
    return {
      id: entry.id,
      therapistId: entry.therapist_id,
      cycleId: entry.cycle_id,
      date: entry.date,
      reason: entry.note,
      createdById: entry.created_by ?? undefined,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at ?? undefined,
      requestedBy: requester?.full_name ?? 'Unknown user',
      cycleLabel: cycle
        ? formatHumanCycleRange(cycle.start_date, cycle.end_date)
        : 'Unknown Schedule Block',
      entryType: entry.override_type,
      shiftType: entry.shift_type,
      source: (entry.source === 'manager' ? 'manager' : 'therapist') as 'manager' | 'therapist',
      intent: entry.intent ?? null,
      canDelete: entry.therapist_id === user.id,
    }
  })
  const intakeHref = `/availability/intake${toSearchString(params)}`

  return (
    <div className="availability-page-print space-y-5">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <AvailabilityPlannerFocusProvider
        initialFocusedTherapistName={plannerTherapistNameForDefault}
      >
        <ManagerSchedulingInputs
          key={`${selectedCycleId}:${initialRoster ?? 'missing'}`}
          cycles={cycles}
          therapists={plannerTherapists}
          overrides={plannerOverrides}
          availabilityEntries={availabilityRows}
          initialCycleId={selectedCycleId}
          initialTherapistId={selectedPlannerTherapistId}
          submittedRows={submittedAvailabilityRows}
          missingRows={missingAvailabilityRows}
          initialRosterFilter={
            initialRoster === 'submitted_with_exceptions' ||
            initialRoster === 'submitted_no_exceptions' ||
            initialRoster === 'submitted' ||
            initialRoster === 'has_requests' ||
            initialRoster === 'all'
              ? initialRoster
              : 'missing'
          }
          saveManagerPlannerDatesAction={saveManagerPlannerDatesAction}
          saveManagerAvailabilityRequestsAction={saveManagerAvailabilityRequestsAction}
          copyAvailabilityFromPreviousCycleAction={copyAvailabilityFromPreviousCycleAction}
          availabilityWindow={availabilityWindow}
          toolbarUtilities={
            <MoreActionsMenu
              label="Utilities"
              triggerClassName="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border/80 bg-background/90 px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
            >
              <a
                href="/api/availability/export"
                className="flex h-11 items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-secondary"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
              <Link
                href="/shift-board"
                className="flex h-11 items-center rounded-sm px-3 py-2 text-sm hover:bg-secondary"
              >
                Shift board
              </Link>
              <Link
                href="/schedule/planning"
                className="flex h-11 items-center rounded-sm px-3 py-2 text-sm hover:bg-secondary"
              >
                Schedule Block Planning
              </Link>
              <Link
                href={intakeHref}
                className="flex h-11 items-center rounded-sm px-3 py-2 text-sm hover:bg-secondary"
              >
                Email intake{intakeNeedsReviewCount > 0 ? ` (${intakeNeedsReviewCount})` : ''}
              </Link>
              {selectedCycleId ? (
                availabilityWindow.locked ? (
                  <form action={reopenAvailabilityWindowAction} className="px-3 py-2">
                    <input type="hidden" name="cycle_id" value={selectedCycleId} />
                    <p className="mb-2 text-xs leading-5 text-muted-foreground">
                      Reopens therapist edits. Existing draft schedule work stays unchanged until
                      reviewed.
                    </p>
                    <button
                      type="submit"
                      className="flex h-10 w-full items-center rounded-sm text-left text-sm font-medium hover:bg-secondary"
                    >
                      Reopen availability
                    </button>
                  </form>
                ) : (
                  <form action={closeAvailabilityWindowAction} className="px-3 py-2">
                    <input type="hidden" name="cycle_id" value={selectedCycleId} />
                    <button
                      type="submit"
                      className="flex h-10 w-full items-center rounded-sm text-left text-sm font-medium hover:bg-secondary"
                    >
                      Lock availability
                    </button>
                  </form>
                )
              ) : null}
              <PrintMenuItem />
            </MoreActionsMenu>
          }
        />
      </AvailabilityPlannerFocusProvider>
    </div>
  )
}
