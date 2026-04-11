import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Download, Plus } from 'lucide-react'

import {
  AvailabilityEntriesTable,
  type AvailabilityEntryTableRow,
} from '@/app/availability/availability-requests-table'
import {
  applyEmailAvailabilityImportAction,
  copyAvailabilityFromPreviousCycleAction,
  createManualEmailIntakeAction,
  deleteAvailabilityEntryAction,
  deleteManagerPlannerDateAction,
  saveManagerPlannerDatesAction,
  submitTherapistAvailabilityGridAction,
  updateEmailIntakeTherapistAction,
} from '@/app/availability/actions'
import { AvailabilityPlannerFocusProvider } from '@/components/availability/availability-planner-focus-context'
import { AvailabilityOverviewHeader } from '@/components/availability/AvailabilityOverviewHeader'
import {
  EmailIntakePanel,
  type EmailIntakePanelRow,
} from '@/components/availability/EmailIntakePanel'
import { ManagerSchedulingInputs } from '@/components/availability/ManagerSchedulingInputs'
import type { TableToolbarFilters } from '@/components/TableToolbar'
import { FeedbackToast } from '@/components/feedback-toast'
import { MoreActionsMenu } from '@/components/more-actions-menu'
import { PrintMenuItem } from '@/components/print-menu-item'
import { TherapistAvailabilityWorkspace } from '@/components/availability/TherapistAvailabilityWorkspace'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import { formatHumanCycleRange } from '@/lib/calendar-utils'
import { buildMissingAvailabilityRows } from '@/lib/employee-directory'
import { toUiRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
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
}

type AvailabilityRow = {
  id: string
  date: string
  shift_type: AvailabilityShiftType
  override_type: AvailabilityOverrideType
  note: string | null
  created_at: string
  updated_at?: string | null
  source?: 'therapist' | 'manager' | null
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
}

type AvailabilityEmailIntakeRow = {
  id: string
  from_email: string
  from_name: string | null
  subject: string | null
  received_at: string
  parse_status: 'parsed' | 'needs_review' | 'failed' | 'applied'
  parse_summary: string | null
  matched_therapist_id: string | null
  parsed_requests: Array<{
    date: string
    override_type: 'force_off' | 'force_on'
  }> | null
  profiles: { full_name: string } | { full_name: string }[] | null
  schedule_cycles:
    | { label: string; start_date: string; end_date: string }
    | { label: string; start_date: string; end_date: string }[]
    | null
}

type AvailabilityEmailAttachmentRow = {
  intake_id: string
  filename: string
  download_status: 'stored' | 'skipped' | 'failed'
  ocr_status: 'not_run' | 'completed' | 'failed' | 'skipped'
}

type AvailabilityPageSearchParams = {
  cycle?: string | string[]
  copied?: string | string[]
  error?: string | string[]
  success?: string | string[]
  search?: string | string[]
  therapist?: string | string[]
  status?: string | string[]
  startDate?: string | string[]
  endDate?: string | string[]
  sort?: string | string[]
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
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
        'You already had an availability request for that date and shift in this cycle. We updated it.',
      variant: 'success',
    }
  }

  if (error === 'submit_failed') {
    return {
      message: "Couldn't save your availability. Try again.",
      variant: 'error',
    }
  }
  if (success === 'entry_submitted') {
    return {
      message: 'Availability saved and submitted for this cycle.',
      variant: 'success',
    }
  }

  if (success === 'draft_saved') {
    return {
      message:
        'Progress saved. Submit availability when you are ready for it to count as official.',
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
      message: 'Staff scheduling inputs saved.',
      variant: 'success',
    }
  }

  if (success === 'planner_deleted') {
    return {
      message: 'Saved staffing date removed.',
      variant: 'success',
    }
  }

  if (success === 'copy_success') {
    const count = getSearchParam(params?.copied)
    return {
      message: count
        ? `${count} date${Number(count) === 1 ? '' : 's'} copied from the previous block.`
        : 'Availability copied from the previous block.',
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

  if (error === 'planner_delete_failed') {
    return {
      message: "Couldn't remove that date. Try again.",
      variant: 'error',
    }
  }

  if (error === 'copy_no_source') {
    return {
      message:
        'Nothing to copy — this therapist has no saved dates in the previous schedule block.',
      variant: 'error',
    }
  }

  if (error === 'copy_nothing_new') {
    return {
      message: 'All dates from the previous block are already planned for this cycle.',
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
      message: 'Inbound email dates applied to staff availability.',
      variant: 'success',
    }
  }

  if (success === 'email_intake_created') {
    return {
      message: 'Manual intake created. Review the parsed dates below.',
      variant: 'success',
    }
  }

  if (success === 'email_intake_match_saved') {
    return {
      message: 'Therapist match saved. You can apply the intake now.',
      variant: 'success',
    }
  }

  if (error === 'email_intake_apply_failed') {
    return {
      message: "Couldn't apply this request. Review the matched dates first.",
      variant: 'error',
    }
  }

  if (error === 'email_intake_create_failed') {
    return {
      message:
        'To create an intake, choose a therapist and schedule block, then paste text or upload a file.',
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
  const feedback = getAvailabilityFeedback(params)
  const initialStatus = getSearchParam(params?.status)
  const initialSort = getSearchParam(params?.sort)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = toUiRole(profile?.role)
  const canManageAvailability = can(role, 'access_manager_ui')
  let activeTeamCount: number | null = null
  if (canManageAvailability) {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('role', ['therapist', 'lead'])
      .eq('is_active', true)
    activeTeamCount = count ?? null
  }

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { data: cyclesData } = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published, archived_at, availability_due_at')
    .is('archived_at', null)
    .gte('end_date', todayKey)
    .order('start_date', { ascending: true })

  const cycles = (cyclesData ?? []) as Cycle[]

  const submissionsByCycleId: Record<string, { submittedAt: string; lastEditedAt: string }> = {}
  if (!canManageAvailability && cycles.length > 0) {
    const { data: submissionRowsData } = await supabase
      .from('therapist_availability_submissions')
      .select('schedule_cycle_id, submitted_at, last_edited_at')
      .eq('therapist_id', user.id)
      .in(
        'schedule_cycle_id',
        cycles.map((c) => c.id)
      )
    for (const row of submissionRowsData ?? []) {
      const r = row as { schedule_cycle_id: string; submitted_at: string; last_edited_at: string }
      submissionsByCycleId[r.schedule_cycle_id] = {
        submittedAt: r.submitted_at,
        lastEditedAt: r.last_edited_at,
      }
    }
  }
  const selectedCycleIdFromParams = getSearchParam(params?.cycle)
  const selectedTherapistIdFromParams = getSearchParam(params?.therapist)
  const selectedCycle =
    cycles.find((cycle) => cycle.id === selectedCycleIdFromParams) ??
    cycles.find((cycle) => cycle.published === false) ??
    cycles[0] ??
    null
  const selectedCycleId = selectedCycle?.id ?? ''

  let entriesQuery = supabase
    .from('availability_overrides')
    .select(
      'id, date, shift_type, override_type, note, created_at, updated_at, source, therapist_id, cycle_id, profiles!availability_overrides_therapist_id_fkey(full_name), schedule_cycles(label, start_date, end_date)'
    )
    .order('date', { ascending: true })
    .order('created_at', { ascending: false })

  if (selectedCycleId) {
    entriesQuery = entriesQuery.eq('cycle_id', selectedCycleId)
  }

  if (!canManageAvailability) {
    entriesQuery = entriesQuery.eq('therapist_id', user.id)
  }

  const { data: entriesData } = await entriesQuery
  const entries = (entriesData ?? []) as AvailabilityRow[]
  const plannerTherapistsResult = canManageAvailability
    ? await supabase
        .from('profiles')
        .select('id, full_name, shift_type, employment_type')
        .in('role', ['therapist', 'lead'])
        .eq('is_active', true)
        .is('archived_at', null)
        .order('full_name', { ascending: true })
    : { data: [] }
  const plannerOverridesResult =
    canManageAvailability && cycles.length > 0
      ? await supabase
          .from('availability_overrides')
          .select('id, therapist_id, cycle_id, date, shift_type, override_type, note, source')
          .eq('source', 'manager')
          .in(
            'cycle_id',
            cycles.map((cycle) => cycle.id)
          )
          .order('date', { ascending: true })
      : { data: [] }
  const plannerTherapists = (plannerTherapistsResult.data ?? []) as ManagerPlannerTherapistRow[]
  const plannerOverrides = (plannerOverridesResult.data ?? []) as ManagerPlannerOverrideRow[]
  const emailIntakesResult = canManageAvailability
    ? await supabase
        .from('availability_email_intakes')
        .select(
          'id, from_email, from_name, subject, received_at, parse_status, parse_summary, matched_therapist_id, parsed_requests, profiles!availability_email_intakes_matched_therapist_id_fkey(full_name), schedule_cycles(label, start_date, end_date)'
        )
        .order('received_at', { ascending: false })
        .limit(12)
    : { data: [] }
  const rawEmailIntakeRows = (emailIntakesResult.data ?? []) as AvailabilityEmailIntakeRow[]
  const emailIntakeIds = rawEmailIntakeRows.map((row) => row.id)
  const emailAttachmentResult =
    canManageAvailability && emailIntakeIds.length > 0
      ? await supabase
          .from('availability_email_attachments')
          .select('intake_id, filename, download_status, ocr_status')
          .in('intake_id', emailIntakeIds)
      : { data: [] }
  const emailAttachmentRows = (emailAttachmentResult.data ?? []) as AvailabilityEmailAttachmentRow[]
  const attachmentsByIntakeId = new Map<string, AvailabilityEmailAttachmentRow[]>()
  for (const attachment of emailAttachmentRows) {
    const current = attachmentsByIntakeId.get(attachment.intake_id) ?? []
    current.push(attachment)
    attachmentsByIntakeId.set(attachment.intake_id, current)
  }
  const emailIntakeRows: EmailIntakePanelRow[] = rawEmailIntakeRows.map((row) => {
    const matchedTherapist = getOne(row.profiles)
    const matchedCycle = getOne(row.schedule_cycles)
    return {
      id: row.id,
      fromEmail: row.from_email,
      fromName: row.from_name,
      subject: row.subject,
      receivedAt: row.received_at,
      parseStatus: row.parse_status,
      parseSummary: row.parse_summary,
      matchedTherapistId: row.matched_therapist_id,
      matchedTherapistName: matchedTherapist?.full_name ?? null,
      matchedCycleLabel: matchedCycle
        ? `${matchedCycle.label} (${matchedCycle.start_date} to ${matchedCycle.end_date})`
        : null,
      parsedRequests: Array.isArray(row.parsed_requests) ? row.parsed_requests : [],
      attachments: (attachmentsByIntakeId.get(row.id) ?? []).map((attachment) => ({
        filename: attachment.filename,
        download_status: attachment.download_status,
        ocr_status: attachment.ocr_status,
      })),
    }
  })
  const selectedPlannerTherapistId =
    plannerTherapists.find((therapist) => therapist.id === selectedTherapistIdFromParams)?.id ??
    plannerTherapists[0]?.id ??
    ''

  const { data: officialSubmissionRows } =
    canManageAvailability && selectedCycleId
      ? await supabase
          .from('therapist_availability_submissions')
          .select('therapist_id')
          .eq('schedule_cycle_id', selectedCycleId)
      : { data: [] }

  const officialSubmissionTherapistIds = new Set(
    (officialSubmissionRows ?? []).map((row) => (row as { therapist_id: string }).therapist_id)
  )

  const availabilityStatusRows = canManageAvailability
    ? buildMissingAvailabilityRows(
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
          source: entry.source === 'manager' ? 'manager' : 'therapist',
        })),
        selectedCycleId,
        { officialSubmissionTherapistIds }
      )
    : []
  const submittedAvailabilityRows = availabilityStatusRows.filter((row) => row.submitted)
  const missingAvailabilityRows = availabilityStatusRows.filter((row) => !row.submitted)

  const availabilityRows: AvailabilityEntryTableRow[] = entries.map((entry) => {
    const cycle = getOne(entry.schedule_cycles)
    const requester = getOne(entry.profiles)
    return {
      id: entry.id,
      cycleId: entry.cycle_id,
      date: entry.date,
      reason: entry.note,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at ?? undefined,
      requestedBy: requester?.full_name ?? 'Unknown user',
      cycleLabel: cycle
        ? `${cycle.label} (${cycle.start_date} to ${cycle.end_date})`
        : 'Unknown cycle',
      entryType: entry.override_type,
      shiftType: entry.shift_type,
      canDelete: entry.therapist_id === user.id,
    }
  })

  const searchFromUrl = getSearchParam(params?.search) ?? ''
  const plannerTherapistNameForDefault =
    canManageAvailability && selectedPlannerTherapistId
      ? (plannerTherapists.find((t) => t.id === selectedPlannerTherapistId)?.full_name ?? null)
      : null
  const mergedSearchForTable =
    searchFromUrl.trim() !== '' ? searchFromUrl : (plannerTherapistNameForDefault ?? '')

  const initialFilters: Partial<TableToolbarFilters> = {
    search: mergedSearchForTable,
    status: initialStatus ?? undefined,
    startDate: getSearchParam(params?.startDate) ?? '',
    endDate: getSearchParam(params?.endDate) ?? '',
    sort: initialSort === 'oldest' ? 'oldest' : 'newest',
  }

  const entriesCard = (
    <AvailabilityEntriesTable
      role={role}
      rows={availabilityRows}
      deleteAvailabilityEntryAction={deleteAvailabilityEntryAction}
      initialFilters={initialFilters}
      syncSearchFromPlannerFocus={canManageAvailability}
    />
  )
  const emailIntakePanel = canManageAvailability ? (
    <EmailIntakePanel
      rows={emailIntakeRows}
      applyEmailAvailabilityImportAction={applyEmailAvailabilityImportAction}
      createManualEmailIntakeAction={createManualEmailIntakeAction}
      updateEmailIntakeTherapistAction={updateEmailIntakeTherapistAction}
      therapistOptions={plannerTherapists.map((therapist) => ({
        id: therapist.id,
        fullName: therapist.full_name,
      }))}
      cycleOptions={cycles.map((cycle) => ({
        id: cycle.id,
        label: `${cycle.label} (${cycle.start_date} to ${cycle.end_date})`,
      }))}
    />
  ) : null

  const therapistWorkspace = (
    <TherapistAvailabilityWorkspace
      cycles={cycles}
      availabilityRows={availabilityRows}
      initialCycleId={selectedCycleId}
      submissionsByCycleId={submissionsByCycleId}
      submitTherapistAvailabilityGridAction={submitTherapistAvailabilityGridAction}
    />
  )
  const totalRequests = availabilityRows.length
  const needOffRequests = availabilityRows.filter((row) => row.entryType === 'force_off').length
  const availableToWorkRequests = availabilityRows.filter(
    (row) => row.entryType === 'force_on'
  ).length
  const uniqueRequesters = new Set(availabilityRows.map((row) => row.requestedBy)).size
  const responseRatio =
    canManageAvailability && activeTeamCount && activeTeamCount > 0
      ? `${uniqueRequesters}/${activeTeamCount}`
      : null

  return (
    <div className="availability-page-print space-y-7">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <AvailabilityOverviewHeader
        canManageAvailability={canManageAvailability}
        title={canManageAvailability ? 'Staff Availability Management' : 'Availability'}
        subtitle={
          selectedCycle
            ? `${selectedCycle.label} · ${formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)}`
            : 'No upcoming cycle selected'
        }
        totalRequests={totalRequests}
        needOffRequests={needOffRequests}
        availableToWorkRequests={availableToWorkRequests}
        responseRatio={responseRatio}
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
                {canManageAvailability ? 'Open planner' : 'Add availability'}
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
              label="Utilities"
              triggerClassName="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border/80 bg-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
            >
              <a
                href="/api/availability/export"
                className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-secondary"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
              <PrintMenuItem />
            </MoreActionsMenu>
          </>
        }
      />

      {canManageAvailability ? (
        <AvailabilityPlannerFocusProvider
          initialFocusedTherapistName={plannerTherapistNameForDefault}
        >
          <ManagerSchedulingInputs
            cycles={cycles}
            therapists={plannerTherapists}
            overrides={plannerOverrides}
            initialCycleId={selectedCycleId}
            initialTherapistId={selectedPlannerTherapistId}
            submittedRows={submittedAvailabilityRows}
            missingRows={missingAvailabilityRows}
            saveManagerPlannerDatesAction={saveManagerPlannerDatesAction}
            deleteManagerPlannerDateAction={deleteManagerPlannerDateAction}
            copyAvailabilityFromPreviousCycleAction={copyAvailabilityFromPreviousCycleAction}
            reviewRequestsPanel={entriesCard}
          />
          {emailIntakePanel}
        </AvailabilityPlannerFocusProvider>
      ) : (
        <>
          {therapistWorkspace}
          {entriesCard}
        </>
      )}
    </div>
  )
}
