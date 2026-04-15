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
  deleteEmailIntakeAction,
  deleteAvailabilityEntryAction,
  deleteManagerPlannerDateAction,
  reparseEmailIntakeAction,
  saveManagerPlannerDatesAction,
  submitTherapistAvailabilityGridAction,
  updateEmailIntakeTherapistAction,
} from '@/app/availability/actions'
import { AvailabilityPlannerFocusProvider } from '@/components/availability/availability-planner-focus-context'
import { AvailabilityOverviewHeader } from '@/components/availability/AvailabilityOverviewHeader'
import { AvailabilitySummaryChips } from '@/components/availability/availability-summary-chips'
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
import { cn } from '@/lib/utils'
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
  text_content: string | null
  parse_status: 'parsed' | 'needs_review' | 'failed' | 'applied'
  batch_status: 'parsed' | 'needs_review' | 'failed' | 'applied'
  parse_summary: string | null
  item_count: number
  auto_applied_count: number
  needs_review_count: number
  failed_count: number
}

type AvailabilityEmailAttachmentRow = {
  id: string
  intake_id: string
  filename: string
  ocr_text: string | null
  ocr_status: 'not_run' | 'completed' | 'failed' | 'skipped'
}

type AvailabilityEmailIntakeItemRow = {
  id: string
  intake_id: string
  source_type: 'body' | 'attachment'
  source_label: string
  parse_status: 'parsed' | 'auto_applied' | 'needs_review' | 'failed'
  confidence_level: 'high' | 'medium' | 'low'
  confidence_reasons: string[] | null
  extracted_employee_name: string | null
  matched_therapist_id: string | null
  matched_cycle_id: string | null
  raw_text: string | null
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

function buildAvailabilityTabHref(
  params: AvailabilityPageSearchParams | undefined,
  targetTab: 'planner' | 'intake'
): string {
  const searchParams = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (key === 'tab' || value == null) continue
      if (Array.isArray(value)) {
        for (const item of value) {
          searchParams.append(key, item)
        }
        continue
      }
      searchParams.set(key, value)
    }
  }

  searchParams.set('tab', targetTab)
  const query = searchParams.toString()
  return query ? `/availability?${query}` : '/availability'
}

function buildAvailabilityHref(
  params: AvailabilityPageSearchParams | undefined,
  updates: Record<string, string | undefined>,
  hash?: string
): string {
  const searchParams = new URLSearchParams()
  if (params) {
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
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      searchParams.delete(key)
      continue
    }
    searchParams.set(key, value)
  }

  const query = searchParams.toString()
  const base = query ? `/availability?${query}` : '/availability'
  return hash ? `${base}${hash}` : base
}

function stripStoredEmailSubject(text: string | null, subject: string | null): string | null {
  const normalizedText = text?.trim() ?? ''
  if (!normalizedText) return null

  const normalizedSubject = subject?.trim() ?? ''
  if (
    normalizedSubject &&
    normalizedText.startsWith(normalizedSubject) &&
    normalizedText.charAt(normalizedSubject.length) === '\n'
  ) {
    return normalizedText.slice(normalizedSubject.length).trim()
  }

  return normalizedText
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
      message: "Couldn't save availability. Try again.",
      variant: 'error',
    }
  }
  if (success === 'entry_submitted') {
    return {
      message: 'Availability submitted for this cycle.',
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
        ? `${count} date${Number(count) === 1 ? '' : 's'} copied from the previous cycle.`
        : 'Availability copied from the previous cycle.',
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
  const initialRoster = getSearchParam(params?.roster)
  const activeTab = getSearchParam(params?.tab) === 'intake' ? 'intake' : 'planner'

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
          'id, from_email, from_name, subject, received_at, text_content, parse_status, batch_status, parse_summary, item_count, auto_applied_count, needs_review_count, failed_count'
        )
        .order('received_at', { ascending: false })
        .limit(12)
    : { data: [] }
  const rawEmailIntakeRows = (emailIntakesResult.data ?? []) as AvailabilityEmailIntakeRow[]
  const emailIntakeIds = rawEmailIntakeRows.map((row) => row.id)
  const emailItemResult =
    canManageAvailability && emailIntakeIds.length > 0
      ? await supabase
          .from('availability_email_intake_items')
          .select(
            'id, intake_id, source_type, source_label, parse_status, confidence_level, confidence_reasons, extracted_employee_name, matched_therapist_id, matched_cycle_id, raw_text, parsed_requests, profiles!availability_email_intake_items_matched_therapist_id_fkey(full_name), schedule_cycles(label, start_date, end_date)'
          )
          .in('intake_id', emailIntakeIds)
      : { data: [] }
  const emailAttachmentResult =
    canManageAvailability && emailIntakeIds.length > 0
      ? await supabase
          .from('availability_email_attachments')
          .select('id, intake_id, filename, ocr_text, ocr_status')
          .in('intake_id', emailIntakeIds)
      : { data: [] }
  const emailItemRows = (emailItemResult.data ?? []) as AvailabilityEmailIntakeItemRow[]
  const emailAttachmentRows = (emailAttachmentResult.data ?? []) as AvailabilityEmailAttachmentRow[]
  const itemsByIntakeId = new Map<string, AvailabilityEmailIntakeItemRow[]>()
  for (const item of emailItemRows) {
    const current = itemsByIntakeId.get(item.intake_id) ?? []
    current.push(item)
    itemsByIntakeId.set(item.intake_id, current)
  }
  const attachmentsByIntakeId = new Map<string, AvailabilityEmailAttachmentRow[]>()
  for (const attachment of emailAttachmentRows) {
    const current = attachmentsByIntakeId.get(attachment.intake_id) ?? []
    current.push(attachment)
    attachmentsByIntakeId.set(attachment.intake_id, current)
  }
  const emailIntakeRows: EmailIntakePanelRow[] = rawEmailIntakeRows.map((row) => {
    const childItems = itemsByIntakeId.get(row.id) ?? []
    const attachments = attachmentsByIntakeId.get(row.id) ?? []
    return {
      id: row.id,
      fromEmail: row.from_email,
      fromName: row.from_name,
      subject: row.subject,
      receivedAt: row.received_at,
      originalEmailText: stripStoredEmailSubject(row.text_content, row.subject),
      attachmentTexts: attachments.map((attachment) => ({
        filename: attachment.filename,
        ocrText: attachment.ocr_text,
        ocrStatus: attachment.ocr_status,
      })),
      batchStatus: row.batch_status ?? row.parse_status,
      parseSummary: row.parse_summary,
      itemCount: row.item_count,
      autoAppliedCount: row.auto_applied_count,
      needsReviewCount: row.needs_review_count,
      failedCount: row.failed_count,
      reviewItems: childItems
        .filter((item) => item.parse_status !== 'auto_applied')
        .map((item) => {
          const matchedTherapist = getOne(item.profiles)
          const matchedCycle = getOne(item.schedule_cycles)
          return {
            id: item.id,
            sourceType: item.source_type,
            sourceLabel: item.source_label,
            parseStatus: item.parse_status,
            confidenceLevel: item.confidence_level,
            confidenceReasons: Array.isArray(item.confidence_reasons)
              ? item.confidence_reasons
              : [],
            extractedEmployeeName: item.extracted_employee_name,
            matchedTherapistId: item.matched_therapist_id,
            matchedTherapistName: matchedTherapist?.full_name ?? null,
            matchedCycleId: item.matched_cycle_id,
            matchedCycleLabel: matchedCycle
              ? `${matchedCycle.label} (${matchedCycle.start_date} to ${matchedCycle.end_date})`
              : null,
            rawText: item.raw_text,
            parsedRequests: Array.isArray(item.parsed_requests) ? item.parsed_requests : [],
          }
        }),
      autoAppliedItems: childItems
        .filter((item) => item.parse_status === 'auto_applied')
        .map((item) => {
          const matchedTherapist = getOne(item.profiles)
          const matchedCycle = getOne(item.schedule_cycles)
          return {
            id: item.id,
            sourceType: item.source_type,
            sourceLabel: item.source_label,
            parseStatus: item.parse_status,
            confidenceLevel: item.confidence_level,
            confidenceReasons: Array.isArray(item.confidence_reasons)
              ? item.confidence_reasons
              : [],
            extractedEmployeeName: item.extracted_employee_name,
            matchedTherapistId: item.matched_therapist_id,
            matchedTherapistName: matchedTherapist?.full_name ?? null,
            matchedCycleId: item.matched_cycle_id,
            matchedCycleLabel: matchedCycle
              ? `${matchedCycle.label} (${matchedCycle.start_date} to ${matchedCycle.end_date})`
              : null,
            rawText: item.raw_text,
            parsedRequests: Array.isArray(item.parsed_requests) ? item.parsed_requests : [],
          }
        }),
    }
  })
  const intakeNeedsReviewCount = emailIntakeRows.reduce((sum, row) => sum + row.needsReviewCount, 0)
  const selectedPlannerTherapistId =
    plannerTherapists.find((therapist) => therapist.id === selectedTherapistIdFromParams)?.id ??
    plannerTherapists[0]?.id ??
    ''
  const selectedPlannerShiftLabel =
    plannerTherapists.find((therapist) => therapist.id === selectedPlannerTherapistId)
      ?.shift_type === 'night'
      ? 'Night shift'
      : plannerTherapists.find((therapist) => therapist.id === selectedPlannerTherapistId)
            ?.shift_type === 'day'
        ? 'Day shift'
        : null

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
      therapistId: entry.therapist_id,
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
  const defaultSecondaryTab =
    initialStatus ||
    searchFromUrl.trim() !== '' ||
    initialFilters.startDate ||
    initialFilters.endDate
      ? 'inbox'
      : 'roster'

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
      deleteEmailIntakeAction={deleteEmailIntakeAction}
      reparseEmailIntakeAction={reparseEmailIntakeAction}
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
  const plannerHref = buildAvailabilityTabHref(params, 'planner')
  const intakeHref = buildAvailabilityTabHref(params, 'intake')
  const summaryChips = canManageAvailability ? (
    <AvailabilitySummaryChips
      chips={[
        {
          label: 'Not submitted',
          count: missingAvailabilityRows.length,
          href: buildAvailabilityHref(
            params,
            { tab: 'planner', roster: 'missing' },
            '#availability-response-heading'
          ),
          tone: 'warning',
          active: initialRoster === 'missing',
        },
        {
          label: 'Submitted',
          count: submittedAvailabilityRows.length,
          href: buildAvailabilityHref(
            params,
            { tab: 'planner', roster: 'submitted' },
            '#availability-response-heading'
          ),
          tone: 'success',
          active: initialRoster === 'submitted',
        },
        {
          label: 'Need off',
          count: needOffRequests,
          href: buildAvailabilityHref(
            params,
            { tab: 'planner', status: 'force_off' },
            '#availability-request-inbox'
          ),
          tone: 'warning',
          active: initialStatus === 'force_off',
        },
        {
          label: 'Request to work',
          count: availableToWorkRequests,
          href: buildAvailabilityHref(
            params,
            { tab: 'planner', status: 'force_on' },
            '#availability-request-inbox'
          ),
          tone: 'info',
          active: initialStatus === 'force_on',
        },
      ]}
    />
  ) : undefined

  return (
    <div className="availability-page-print space-y-5">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <AvailabilityOverviewHeader
        title={canManageAvailability ? 'Availability Planning' : 'Availability'}
        subtitle={
          selectedCycle
            ? `${formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)}${
                canManageAvailability && selectedPlannerShiftLabel
                  ? ` · ${selectedPlannerShiftLabel}`
                  : ''
              }`
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
        <div className="border-b border-border/70">
          <nav className="-mb-px flex gap-0" aria-label="Availability sections">
            <a
              href={plannerHref}
              className={cn(
                'px-4 py-2 text-sm border-b-2 transition-colors',
                activeTab === 'planner'
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Planner
            </a>
            <a
              href={intakeHref}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors',
                activeTab === 'intake'
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
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
      ) : null}

      {canManageAvailability ? (
        activeTab === 'planner' ? (
          <AvailabilityPlannerFocusProvider
            initialFocusedTherapistName={plannerTherapistNameForDefault}
          >
            <ManagerSchedulingInputs
              cycles={cycles}
              therapists={plannerTherapists}
              overrides={plannerOverrides}
              availabilityEntries={availabilityRows}
              initialCycleId={selectedCycleId}
              initialTherapistId={selectedPlannerTherapistId}
              submittedRows={submittedAvailabilityRows}
              missingRows={missingAvailabilityRows}
              initialRosterFilter={
                initialRoster === 'all' ||
                initialRoster === 'submitted' ||
                initialRoster === 'has_requests'
                  ? initialRoster
                  : 'missing'
              }
              defaultSecondaryTab={defaultSecondaryTab}
              saveManagerPlannerDatesAction={saveManagerPlannerDatesAction}
              deleteManagerPlannerDateAction={deleteManagerPlannerDateAction}
              copyAvailabilityFromPreviousCycleAction={copyAvailabilityFromPreviousCycleAction}
              reviewRequestsPanel={<div id="availability-request-inbox">{entriesCard}</div>}
            />
          </AvailabilityPlannerFocusProvider>
        ) : (
          emailIntakePanel
        )
      ) : (
        <>
          {therapistWorkspace}
          {entriesCard}
        </>
      )}
    </div>
  )
}
