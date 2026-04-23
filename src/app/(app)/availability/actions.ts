'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { SupabaseClient } from '@supabase/supabase-js'

import { can } from '@/lib/auth/can'
import {
  buildPlannerSavePayload,
  getPlannerDateValidationError,
  toOverrideType,
} from '@/lib/availability-planner'
import {
  parseAvailabilityEmailBatchSources,
  summarizeAvailabilityEmailBatch,
  sanitizeParsedRequests,
  stripHtmlToText,
} from '@/lib/availability-email-intake'
import {
  cycleIntakeRequest,
  markRequestsEdited,
  removeIntakeRequest,
} from '@/lib/availability-intake-request-cycler'
import { shiftOverridesToCycle } from '@/lib/copy-cycle-availability'
import { buildManagerOverrideInput } from '@/lib/employee-directory'
import { extractTextFromAttachment } from '@/lib/openai-ocr'
import { createClient } from '@/lib/supabase/server'

async function upsertTherapistSubmissionAfterOfficialSave(
  supabase: SupabaseClient,
  therapistId: string,
  cycleId: string
) {
  const now = new Date().toISOString()
  const { data: existing, error: loadError } = await supabase
    .from('therapist_availability_submissions')
    .select('submitted_at')
    .eq('therapist_id', therapistId)
    .eq('schedule_cycle_id', cycleId)
    .maybeSingle()

  if (loadError) {
    console.error('Failed to load therapist availability submission:', loadError)
    return
  }

  if (!existing) {
    const { error } = await supabase.from('therapist_availability_submissions').insert({
      therapist_id: therapistId,
      schedule_cycle_id: cycleId,
      submitted_at: now,
      last_edited_at: now,
    })
    if (error) {
      console.error('Failed to insert therapist availability submission:', error)
    }
    return
  }

  const { error } = await supabase
    .from('therapist_availability_submissions')
    .update({ last_edited_at: now })
    .eq('therapist_id', therapistId)
    .eq('schedule_cycle_id', cycleId)

  if (error) {
    console.error('Failed to update therapist availability submission:', error)
  }
}

async function touchTherapistSubmissionLastEditedIfExists(
  supabase: SupabaseClient,
  therapistId: string,
  cycleId: string
) {
  if (!cycleId) return
  const now = new Date().toISOString()
  const { data: existing } = await supabase
    .from('therapist_availability_submissions')
    .select('id')
    .eq('therapist_id', therapistId)
    .eq('schedule_cycle_id', cycleId)
    .maybeSingle()

  if (!existing) return

  const { error } = await supabase
    .from('therapist_availability_submissions')
    .update({ last_edited_at: now })
    .eq('therapist_id', therapistId)
    .eq('schedule_cycle_id', cycleId)

  if (error) {
    console.error('Failed to touch therapist availability submission last_edited_at:', error)
  }
}

function revalidateTherapistAvailabilitySurfaces() {
  revalidatePath('/availability')
  revalidatePath('/therapist/availability')
  revalidatePath('/dashboard/staff')
}

type AvailabilityOverrideType = 'force_off' | 'force_on'
type AvailabilityShiftType = 'day' | 'night' | 'both'
type AvailabilityEmailItemStatus = 'parsed' | 'auto_applied' | 'needs_review' | 'failed'
type IntakeScopedOverrideRow = {
  id: string
  cycle_id: string
  therapist_id: string
  date: string
  shift_type: AvailabilityShiftType
  source_intake_id: string | null
  source_intake_item_id: string | null
}

type AvailabilityEmailItemSummaryRow = {
  parse_status: AvailabilityEmailItemStatus
  parsed_requests: unknown
}

type AvailabilityEmailAttachmentRow = {
  id: string
  filename: string
  content_type: string
  content_base64: string | null
  ocr_status: 'not_run' | 'completed' | 'failed' | 'skipped' | null
  ocr_text: string | null
  ocr_model: string | null
  ocr_error: string | null
}

function getReturnPath(value: string | null): '/availability' | '/therapist/availability' {
  return value === '/therapist/availability' ? '/therapist/availability' : '/availability'
}

function buildAvailabilityUrl(
  params?: Record<string, string | undefined>,
  returnPath: '/availability' | '/therapist/availability' = '/availability'
) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      search.set(key, value)
    }
  }
  const query = search.toString()
  return query.length > 0 ? `${returnPath}?${query}` : returnPath
}

/** Email intake flows should return to the Intake tab after redirect. */
function buildEmailIntakeAvailabilityUrl(params?: Record<string, string | undefined>) {
  return buildAvailabilityUrl({ ...params, tab: 'intake' })
}

function summarizeAvailabilityItemRows(rows: AvailabilityEmailItemSummaryRow[]) {
  const items = rows.map((row, index) => ({
    sourceType: 'body' as const,
    sourceLabel: `Item ${index + 1}`,
    extractedEmployeeName: null,
    employeeMatchCandidates: [],
    matchedTherapistId: null,
    matchedCycleId: null,
    parseStatus: row.parse_status,
    confidenceLevel: 'low' as const,
    confidenceReasons: [],
    requests: sanitizeParsedRequests(row.parsed_requests),
    unresolvedLines: [],
    rawText: '',
  }))

  const batchSummary = summarizeAvailabilityEmailBatch(items)
  const batchStatus: 'parsed' | 'needs_review' | 'failed' | 'applied' =
    rows.length === 0
      ? 'failed'
      : rows.some((row) => row.parse_status === 'needs_review' || row.parse_status === 'failed')
        ? 'needs_review'
        : rows.every((row) => row.parse_status === 'auto_applied')
          ? 'applied'
          : 'parsed'

  return {
    batchStatus,
    parseSummary: batchSummary.summary,
    parsedRequests: rows.flatMap((row) => sanitizeParsedRequests(row.parsed_requests)),
    itemCount: rows.length,
    autoAppliedCount: rows.filter((row) => row.parse_status === 'auto_applied').length,
    needsReviewCount: rows.filter((row) => row.parse_status === 'needs_review').length,
    failedCount: rows.filter((row) => row.parse_status === 'failed').length,
  }
}

function buildOverrideScopeKey(params: {
  cycleId: string
  therapistId: string
  date: string
  shiftType: AvailabilityShiftType
}) {
  return `${params.cycleId}::${params.therapistId}::${params.date}::${params.shiftType}`
}

async function syncAvailabilityOverridesForEmailIntake(params: {
  supabase: SupabaseClient
  intakeId: string
  itemId?: string
  payload: Array<
    ReturnType<typeof buildManagerOverrideInput> & {
      source_intake_id: string
      source_intake_item_id: string | null
    }
  >
}) {
  const { supabase, intakeId, itemId, payload } = params
  const existingOverridesQuery = supabase
    .from('availability_overrides')
    .select('id, cycle_id, therapist_id, date, shift_type, source_intake_id, source_intake_item_id')

  const { data: existingOverrides, error: existingOverridesError } = itemId
    ? await existingOverridesQuery.eq('source_intake_item_id', itemId)
    : await existingOverridesQuery.eq('source_intake_id', intakeId)

  if (existingOverridesError) {
    console.error(
      'Failed to load existing intake-linked availability overrides:',
      existingOverridesError
    )
    return { error: existingOverridesError }
  }

  const keepKeys = new Set(
    payload.map((row) =>
      buildOverrideScopeKey({
        cycleId: row.cycle_id,
        therapistId: row.therapist_id,
        date: row.date,
        shiftType: row.shift_type,
      })
    )
  )
  const rowsToDelete = ((existingOverrides ?? []) as IntakeScopedOverrideRow[])
    .filter(
      (row) =>
        !keepKeys.has(
          buildOverrideScopeKey({
            cycleId: row.cycle_id,
            therapistId: row.therapist_id,
            date: row.date,
            shiftType: row.shift_type,
          })
        )
    )
    .map((row) => row.id)

  if (rowsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('availability_overrides')
      .delete()
      .in('id', rowsToDelete)

    if (deleteError) {
      console.error('Failed to clear stale intake-linked availability overrides:', deleteError)
      return { error: deleteError }
    }
  }

  const { error: upsertError } = await supabase
    .from('availability_overrides')
    .upsert(payload, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

  if (upsertError) {
    console.error('Failed to apply availability email intake:', upsertError)
    return { error: upsertError }
  }

  return { error: null }
}

async function refreshAvailabilityEmailIntakeBatchState(
  supabase: SupabaseClient,
  intakeId: string
) {
  const { data: rows, error } = await supabase
    .from('availability_email_intake_items')
    .select('parse_status, parsed_requests')
    .eq('intake_id', intakeId)

  if (error) {
    console.error('Failed to load intake items for batch refresh:', error)
    return
  }

  const summary = summarizeAvailabilityItemRows(
    ((rows ?? []) as AvailabilityEmailItemSummaryRow[]) ?? []
  )

  const { error: updateError } = await supabase
    .from('availability_email_intakes')
    .update({
      parse_status: summary.batchStatus,
      batch_status: summary.batchStatus,
      parse_summary: summary.parseSummary,
      parsed_requests: summary.parsedRequests,
      item_count: summary.itemCount,
      auto_applied_count: summary.autoAppliedCount,
      needs_review_count: summary.needsReviewCount,
      failed_count: summary.failedCount,
    })
    .eq('id', intakeId)

  if (updateError) {
    console.error('Failed to refresh intake batch state:', updateError)
  }
}

async function loadAvailabilityEmailParsingContext(supabase: SupabaseClient) {
  const todayKey = new Date().toISOString().slice(0, 10)
  const [{ data: profileRows }, { data: cycleRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, is_active')
      .in('role', ['therapist', 'lead'])
      .eq('is_active', true)
      .is('archived_at', null)
      .order('full_name', { ascending: true }),
    supabase
      .from('schedule_cycles')
      .select('id, label, start_date, end_date')
      .is('archived_at', null)
      .gte('end_date', todayKey)
      .order('start_date', { ascending: true }),
  ])

  return {
    profiles:
      ((profileRows ?? []) as Array<{
        id: string
        full_name: string
        is_active?: boolean | null
      }>) ?? [],
    cycles:
      (
        (cycleRows ?? []) as Array<{
          id: string
          label: string
          start_date: string
          end_date: string
        }>
      ).filter((cycle) => cycle.start_date && cycle.end_date) ?? [],
  }
}

async function getAuthenticatedUserWithRole() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return {
    supabase,
    user,
    role: profile?.role ?? null,
  }
}

export async function submitAvailabilityEntryAction(formData: FormData) {
  const { supabase, user } = await getAuthenticatedUserWithRole()
  const returnPath = getReturnPath(String(formData.get('return_to') ?? '').trim() || null)

  const date = String(formData.get('date') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const shiftType = String(formData.get('shift_type') ?? 'both').trim() as AvailabilityShiftType
  const overrideType = String(
    formData.get('override_type') ?? ''
  ).trim() as AvailabilityOverrideType
  const note = String(formData.get('note') ?? '').trim()

  if (
    !date ||
    !cycleId ||
    (shiftType !== 'day' && shiftType !== 'night' && shiftType !== 'both') ||
    (overrideType !== 'force_off' && overrideType !== 'force_on')
  ) {
    redirect(buildAvailabilityUrl({ error: 'submit_failed' }, returnPath))
  }

  const { error } = await supabase.from('availability_overrides').upsert(
    {
      therapist_id: user.id,
      cycle_id: cycleId,
      date,
      shift_type: shiftType,
      override_type: overrideType,
      note: note || null,
      created_by: user.id,
      source: 'therapist',
    },
    { onConflict: 'cycle_id,therapist_id,date,shift_type' }
  )

  if (error) {
    console.error('Failed to save availability override:', error)
    redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
  }

  await upsertTherapistSubmissionAfterOfficialSave(supabase, user.id, cycleId)

  revalidateTherapistAvailabilitySurfaces()
  redirect(buildAvailabilityUrl({ success: 'entry_submitted', cycle: cycleId }, returnPath))
}

export async function submitTherapistAvailabilityGridAction(formData: FormData) {
  const { supabase, user } = await getAuthenticatedUserWithRole()
  const returnPath = getReturnPath(String(formData.get('return_to') ?? '').trim() || null)

  const workflowRaw = String(formData.get('workflow') ?? 'submit')
    .trim()
    .toLowerCase()
  const workflow: 'draft' | 'submit' = workflowRaw === 'draft' ? 'draft' : 'submit'

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const canWorkDates = formData
    .getAll('can_work_dates')
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)
  const cannotWorkDates = formData
    .getAll('cannot_work_dates')
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)
  const rawNotesJson = String(formData.get('notes_json') ?? '').trim()

  if (!cycleId) {
    redirect(buildAvailabilityUrl({ error: 'submit_failed' }, returnPath))
  }

  const { data: cycle } = await supabase
    .from('schedule_cycles')
    .select('start_date, end_date')
    .eq('id', cycleId)
    .maybeSingle()

  if (!cycle) {
    redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
  }

  const isValidCycleDate = (date: string) => date >= cycle.start_date && date <= cycle.end_date

  const uniqueCanWorkDates = Array.from(new Set(canWorkDates.filter(isValidCycleDate)))
  const uniqueCannotWorkDates = Array.from(new Set(cannotWorkDates.filter(isValidCycleDate)))
  const cannotWorkSet = new Set(uniqueCannotWorkDates)
  const resolvedCanWorkDates = uniqueCanWorkDates.filter((date) => !cannotWorkSet.has(date))
  let notesByDate: Record<string, string> = {}
  if (rawNotesJson) {
    try {
      const parsed = JSON.parse(rawNotesJson) as Record<string, unknown>
      notesByDate = Object.fromEntries(
        Object.entries(parsed)
          .map(([date, note]) => [date, String(note ?? '').trim()])
          .filter(([date, note]) => isValidCycleDate(date) && note.length > 0)
      )
    } catch (error) {
      console.error('Failed to parse therapist availability notes payload:', error)
      redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
    }
  }

  const { data: existingRows, error: existingRowsError } = await supabase
    .from('availability_overrides')
    .select('id, date')
    .eq('cycle_id', cycleId)
    .eq('therapist_id', user.id)
    .eq('shift_type', 'both')
    .eq('source', 'therapist')

  if (existingRowsError) {
    console.error('Failed to load existing therapist availability overrides:', existingRowsError)
    redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
  }

  const desiredDates = new Set([...resolvedCanWorkDates, ...uniqueCannotWorkDates])
  const rowsToDelete = (existingRows ?? [])
    .filter((row) => !desiredDates.has(String(row.date)))
    .map((row) => String(row.id))

  if (rowsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('availability_overrides')
      .delete()
      .in('id', rowsToDelete)

    if (deleteError) {
      console.error('Failed to remove therapist availability overrides:', deleteError)
      redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
    }
  }

  const payload = [
    ...resolvedCanWorkDates.map((date) => ({
      therapist_id: user.id,
      cycle_id: cycleId,
      date,
      shift_type: 'both' as const,
      override_type: 'force_on' as const,
      note: notesByDate[date] ?? null,
      created_by: user.id,
      source: 'therapist' as const,
    })),
    ...uniqueCannotWorkDates.map((date) => ({
      therapist_id: user.id,
      cycle_id: cycleId,
      date,
      shift_type: 'both' as const,
      override_type: 'force_off' as const,
      note: notesByDate[date] ?? null,
      created_by: user.id,
      source: 'therapist' as const,
    })),
  ]

  if (payload.length > 0) {
    const { error: upsertError } = await supabase
      .from('availability_overrides')
      .upsert(payload, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

    if (upsertError) {
      console.error('Failed to save therapist availability grid:', upsertError)
      redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
    }
  }

  if (workflow === 'submit') {
    await upsertTherapistSubmissionAfterOfficialSave(supabase, user.id, cycleId)
  }

  revalidateTherapistAvailabilitySurfaces()
  const successParam = workflow === 'draft' ? 'draft_saved' : 'entry_submitted'
  redirect(buildAvailabilityUrl({ success: successParam, cycle: cycleId }, returnPath))
}

export async function deleteAvailabilityEntryAction(formData: FormData) {
  const { supabase, user } = await getAuthenticatedUserWithRole()
  const returnPath = getReturnPath(String(formData.get('return_to') ?? '').trim() || null)

  const entryId = String(formData.get('entry_id') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  if (!entryId) {
    redirect(returnPath)
  }

  const { error } = await supabase
    .from('availability_overrides')
    .delete()
    .eq('id', entryId)
    .eq('therapist_id', user.id)

  if (error) {
    console.error('Failed to delete availability override:', error)
    redirect(
      buildAvailabilityUrl({ error: 'delete_failed', cycle: cycleId || undefined }, returnPath)
    )
  }

  if (cycleId) {
    await touchTherapistSubmissionLastEditedIfExists(supabase, user.id, cycleId)
  }

  revalidateTherapistAvailabilitySurfaces()
  redirect(
    buildAvailabilityUrl({ success: 'entry_deleted', cycle: cycleId || undefined }, returnPath)
  )
}

export async function saveManagerPlannerDatesAction(formData: FormData) {
  const { supabase, user, role } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui')) {
    redirect('/availability')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const therapistId = String(formData.get('therapist_id') ?? '').trim()
  const shiftType = String(formData.get('shift_type') ?? 'both').trim() as AvailabilityShiftType
  const mode = String(formData.get('mode') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()
  const dates = formData
    .getAll('dates')
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)

  const { data: cycle } = await supabase
    .from('schedule_cycles')
    .select('start_date, end_date')
    .eq('id', cycleId)
    .maybeSingle()

  if (
    (shiftType !== 'day' && shiftType !== 'night' && shiftType !== 'both') ||
    (mode !== 'will_work' && mode !== 'cannot_work')
  ) {
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId || undefined,
        therapist: therapistId || undefined,
        error: 'planner_save_failed',
      })
    )
  }

  const validationError = getPlannerDateValidationError({
    cycle: cycle ? { start_date: cycle.start_date, end_date: cycle.end_date } : null,
    therapistId,
    dates,
  })

  if (validationError) {
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId || undefined,
        therapist: therapistId || undefined,
        error: 'planner_save_failed',
      })
    )
  }

  const overrideType = toOverrideType(mode)
  const { data: existingRows, error: existingRowsError } = await supabase
    .from('availability_overrides')
    .select('id, date')
    .eq('cycle_id', cycleId)
    .eq('therapist_id', therapistId)
    .eq('shift_type', shiftType)
    .eq('override_type', overrideType)
    .eq('source', 'manager')

  if (existingRowsError) {
    console.error('Failed to load existing manager planner overrides:', existingRowsError)
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId,
        therapist: therapistId,
        error: 'planner_save_failed',
      })
    )
  }

  const payload = buildPlannerSavePayload({
    cycleId,
    therapistId,
    shiftType,
    mode,
    dates,
    note,
    managerId: user.id,
  })

  const keepDates = new Set(payload.map((row) => row.date))
  const rowsToDelete = (existingRows ?? [])
    .filter((row) => !keepDates.has(String(row.date)))
    .map((row) => String(row.id))

  if (rowsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('availability_overrides')
      .delete()
      .in('id', rowsToDelete)

    if (deleteError) {
      console.error('Failed to replace manager planner overrides:', deleteError)
      redirect(
        buildAvailabilityUrl({
          cycle: cycleId,
          therapist: therapistId,
          error: 'planner_save_failed',
        })
      )
    }
  }

  if (payload.length > 0) {
    const { error: upsertError } = await supabase
      .from('availability_overrides')
      .upsert(payload, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

    if (upsertError) {
      console.error('Failed to save manager planner overrides:', upsertError)
      redirect(
        buildAvailabilityUrl({
          cycle: cycleId,
          therapist: therapistId,
          error: 'planner_save_failed',
        })
      )
    }
  }

  revalidatePath('/availability')
  redirect(
    buildAvailabilityUrl({
      cycle: cycleId,
      therapist: therapistId,
      success: 'planner_saved',
    })
  )
}

export async function deleteManagerPlannerDateAction(formData: FormData) {
  const { supabase, role } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui')) {
    redirect('/availability')
  }

  const overrideId = String(formData.get('override_id') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const therapistId = String(formData.get('therapist_id') ?? '').trim()

  if (!overrideId) {
    redirect(
      buildAvailabilityUrl({ cycle: cycleId || undefined, therapist: therapistId || undefined })
    )
  }

  const { error } = await supabase
    .from('availability_overrides')
    .delete()
    .eq('id', overrideId)
    .eq('source', 'manager')

  if (error) {
    console.error('Failed to delete manager planner override:', error)
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId || undefined,
        therapist: therapistId || undefined,
        error: 'planner_delete_failed',
      })
    )
  }

  revalidatePath('/availability')
  redirect(
    buildAvailabilityUrl({
      cycle: cycleId || undefined,
      therapist: therapistId || undefined,
      success: 'planner_deleted',
    })
  )
}

export async function applyEmailAvailabilityImportAction(formData: FormData) {
  const { supabase, user, role } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui')) {
    redirect('/availability')
  }

  const itemId = String(formData.get('item_id') ?? '').trim()
  const intakeId = String(formData.get('intake_id') ?? '').trim()

  if (!itemId && !intakeId) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_apply_failed' }))
  }

  let effectiveIntakeId = intakeId
  let matchedTherapistId: string | null = null
  let matchedCycleId: string | null = null
  let parsedRequests = []

  if (itemId) {
    const { data: item, error: itemError } = await supabase
      .from('availability_email_intake_items')
      .select(
        'id, intake_id, matched_therapist_id, matched_cycle_id, parsed_requests, source_label'
      )
      .eq('id', itemId)
      .maybeSingle()

    if (itemError || !item) {
      console.error('Failed to load availability email intake item:', itemError)
      redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_apply_failed' }))
    }

    effectiveIntakeId = String(item.intake_id)
    matchedTherapistId = item.matched_therapist_id
    matchedCycleId = item.matched_cycle_id
    parsedRequests = sanitizeParsedRequests(item.parsed_requests)
  } else {
    const { data: intake, error: intakeError } = await supabase
      .from('availability_email_intakes')
      .select('id, matched_therapist_id, matched_cycle_id, parsed_requests')
      .eq('id', intakeId)
      .maybeSingle()

    if (intakeError || !intake) {
      console.error('Failed to load availability email intake:', intakeError)
      redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_apply_failed' }))
    }

    matchedTherapistId = intake.matched_therapist_id
    matchedCycleId = intake.matched_cycle_id
    parsedRequests = sanitizeParsedRequests(intake.parsed_requests)
  }

  if (!matchedTherapistId || !matchedCycleId) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_apply_failed' }))
  }

  if (parsedRequests.length === 0) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_apply_failed' }))
  }

  const payload = parsedRequests.map(
    (request) =>
      ({
        ...buildManagerOverrideInput({
          cycleId: matchedCycleId,
          therapistId: matchedTherapistId,
          date: request.date,
          shiftType: request.shift_type,
          overrideType: request.override_type,
          note: request.note ?? `Imported from email: ${request.source_line}`,
          managerId: user.id,
        }),
        source_intake_id: effectiveIntakeId,
        source_intake_item_id: itemId || null,
      }) satisfies ReturnType<typeof buildManagerOverrideInput> & {
        source_intake_id: string
        source_intake_item_id: string | null
      }
  )

  const { error: upsertError } = await syncAvailabilityOverridesForEmailIntake({
    supabase,
    intakeId: effectiveIntakeId,
    itemId: itemId || undefined,
    payload,
  })

  if (upsertError) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_apply_failed' }))
  }

  if (itemId) {
    const { error: itemUpdateError } = await supabase
      .from('availability_email_intake_items')
      .update({
        parse_status: 'auto_applied',
        auto_applied_at: new Date().toISOString(),
        auto_applied_by: user.id,
        apply_error: null,
      })
      .eq('id', itemId)

    if (itemUpdateError) {
      console.error(
        'Failed to mark availability email intake item as auto-applied:',
        itemUpdateError
      )
      redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_apply_failed' }))
    }
  } else {
    const { error: updateError } = await supabase
      .from('availability_email_intakes')
      .update({
        parse_status: 'applied',
        batch_status: 'applied',
        applied_at: new Date().toISOString(),
        applied_by: user.id,
      })
      .eq('id', intakeId)

    if (updateError) {
      console.error('Failed to mark availability email intake as applied:', updateError)
      redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_apply_failed' }))
    }
  }

  if (itemId && effectiveIntakeId) {
    await refreshAvailabilityEmailIntakeBatchState(supabase, effectiveIntakeId)
  }

  revalidatePath('/availability')
  return {
    ok: true as const,
    cycleId: matchedCycleId,
    therapistId: matchedTherapistId,
  }
}

export async function updateEmailIntakeTherapistAction(formData: FormData) {
  const { supabase, role } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui')) {
    redirect('/availability')
  }

  const itemId = String(formData.get('item_id') ?? '').trim()
  const intakeId = String(formData.get('intake_id') ?? '').trim()
  const therapistId = String(formData.get('therapist_id') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()

  if ((!itemId && !intakeId) || !therapistId || !cycleId) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_match_failed' }))
  }

  if (itemId) {
    const { data: item, error: loadError } = await supabase
      .from('availability_email_intake_items')
      .select('intake_id, parsed_requests')
      .eq('id', itemId)
      .maybeSingle()

    if (loadError || !item) {
      console.error('Failed to load intake item for therapist update:', loadError)
      redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_match_failed' }))
    }

    const parsedRequests = sanitizeParsedRequests(item.parsed_requests)
    const nextStatus: AvailabilityEmailItemStatus =
      !cycleId || parsedRequests.length === 0 ? 'failed' : 'parsed'

    const { error: itemUpdateError } = await supabase
      .from('availability_email_intake_items')
      .update({
        matched_therapist_id: therapistId,
        matched_cycle_id: cycleId,
        parse_status: nextStatus,
      })
      .eq('id', itemId)

    if (itemUpdateError) {
      console.error('Failed to update intake item therapist match:', itemUpdateError)
      redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_match_failed' }))
    }

    await refreshAvailabilityEmailIntakeBatchState(supabase, String(item.intake_id))
  } else {
    const { data: intake, error: loadError } = await supabase
      .from('availability_email_intakes')
      .select('matched_cycle_id, parsed_requests')
      .eq('id', intakeId)
      .maybeSingle()

    if (loadError || !intake) {
      console.error('Failed to load intake for therapist update:', loadError)
      redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_match_failed' }))
    }

    const parsedRequests = sanitizeParsedRequests(intake.parsed_requests)
    const nextStatus: 'parsed' | 'needs_review' | 'failed' =
      !cycleId || parsedRequests.length === 0 ? 'failed' : 'parsed'

    const { error: updateError } = await supabase
      .from('availability_email_intakes')
      .update({
        matched_therapist_id: therapistId,
        matched_cycle_id: cycleId,
        parse_status: nextStatus,
      })
      .eq('id', intakeId)

    if (updateError) {
      console.error('Failed to update intake therapist match:', updateError)
      redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_match_failed' }))
    }
  }

  revalidatePath('/availability')
  redirect(buildEmailIntakeAvailabilityUrl({ success: 'email_intake_match_saved' }))
}

export async function updateEmailIntakeItemRequestAction(formData: FormData) {
  const { supabase, role } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui')) {
    redirect('/availability')
  }

  const itemId = String(formData.get('item_id') ?? '').trim()
  const date = String(formData.get('date') ?? '').trim()
  const overrideType = String(formData.get('override_type') ?? '').trim()
  const shiftType = String(formData.get('shift_type') ?? '').trim()
  const modeRaw = String(formData.get('mode') ?? '').trim()
  const mode = modeRaw === 'remove' ? 'remove' : 'cycle'

  if (
    !itemId ||
    !date ||
    (overrideType !== 'force_off' && overrideType !== 'force_on') ||
    (shiftType !== 'day' && shiftType !== 'night' && shiftType !== 'both')
  ) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_request_update_failed' }))
  }

  const { data: item, error: loadError } = await supabase
    .from('availability_email_intake_items')
    .select(
      'id, intake_id, parsed_requests, original_parsed_requests, matched_therapist_id, matched_cycle_id'
    )
    .eq('id', itemId)
    .maybeSingle()

  if (loadError || !item) {
    console.error('Failed to load intake item for request update:', loadError)
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_request_update_failed' }))
  }

  const chipTarget = {
    date,
    override_type: overrideType as 'force_off' | 'force_on',
    shift_type: shiftType as 'day' | 'night' | 'both',
  }
  const parsedRequests =
    mode === 'remove'
      ? removeIntakeRequest({ requests: item.parsed_requests, target: chipTarget })
      : cycleIntakeRequest({ requests: item.parsed_requests, target: chipTarget })
  const nextParseStatus: AvailabilityEmailItemStatus =
    parsedRequests.length === 0
      ? 'failed'
      : item.matched_therapist_id && item.matched_cycle_id
        ? 'parsed'
        : 'needs_review'
  const manuallyEditedAtUpdate = item.original_parsed_requests
    ? {
        manually_edited_at: item.original_parsed_requests
          ? markRequestsEdited({
              originalRequests: item.original_parsed_requests,
              currentRequests: parsedRequests,
            })
            ? new Date().toISOString()
            : null
          : null,
      }
    : {}

  const { error: updateError } = await supabase
    .from('availability_email_intake_items')
    .update({
      parse_status: nextParseStatus,
      parsed_requests: parsedRequests,
      ...manuallyEditedAtUpdate,
    })
    .eq('id', itemId)

  if (updateError) {
    console.error('Failed to update intake item request:', updateError)
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_request_update_failed' }))
  }

  if (item.intake_id) {
    await refreshAvailabilityEmailIntakeBatchState(supabase, String(item.intake_id))
  }

  revalidatePath('/availability')
  return { ok: true as const }
}

export async function reparseEmailIntakeAction(formData: FormData) {
  const { supabase, role } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui')) {
    redirect('/availability')
  }

  const intakeId = String(formData.get('intake_id') ?? '').trim()
  if (!intakeId) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_reparse_failed' }))
  }

  const [
    { data: intake, error: intakeError },
    { data: existingItems, error: itemLoadError },
    { data: attachmentRows, error: attachmentLoadError },
  ] = await Promise.all([
    supabase
      .from('availability_email_intakes')
      .select('id, text_content, html_content')
      .eq('id', intakeId)
      .maybeSingle(),
    supabase.from('availability_email_intake_items').select('id').eq('intake_id', intakeId),
    supabase
      .from('availability_email_attachments')
      .select(
        'id, filename, content_type, content_base64, ocr_status, ocr_text, ocr_model, ocr_error'
      )
      .eq('intake_id', intakeId),
  ])

  if (intakeError || !intake || itemLoadError || attachmentLoadError) {
    console.error('Failed to load stored availability email intake for reparsing:', {
      intakeError,
      itemLoadError,
      attachmentLoadError,
    })
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_reparse_failed' }))
  }

  const { profiles, cycles } = await loadAvailabilityEmailParsingContext(supabase)
  const processedAttachments = [] as AvailabilityEmailAttachmentRow[]

  for (const attachment of (attachmentRows ?? []) as AvailabilityEmailAttachmentRow[]) {
    const nextOcr = attachment.content_base64
      ? await extractTextFromAttachment({
          contentBase64: attachment.content_base64,
          contentType: attachment.content_type,
          filename: attachment.filename,
        })
      : {
          status: attachment.ocr_status ?? 'not_run',
          text: attachment.ocr_text,
          model: attachment.ocr_model,
          error: attachment.ocr_error,
        }

    const { error: attachmentUpdateError } = await supabase
      .from('availability_email_attachments')
      .update({
        ocr_status: nextOcr.status,
        ocr_text: nextOcr.text,
        ocr_model: nextOcr.model,
        ocr_error: nextOcr.error,
      })
      .eq('id', attachment.id)

    if (attachmentUpdateError) {
      console.error('Failed to update intake attachment OCR state:', attachmentUpdateError)
      redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_reparse_failed' }))
    }

    processedAttachments.push({
      ...attachment,
      ocr_status: nextOcr.status,
      ocr_text: nextOcr.text,
      ocr_model: nextOcr.model,
      ocr_error: nextOcr.error,
    })
  }

  const parsedBatch = parseAvailabilityEmailBatchSources({
    normalizedBodyText:
      intake.text_content?.trim() || stripHtmlToText(intake.html_content ?? '') || '',
    attachments: processedAttachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      rawText: attachment.ocr_text,
      ocrStatus: attachment.ocr_status ?? 'not_run',
      ocrModel: attachment.ocr_model,
      ocrError: attachment.ocr_error,
    })),
    cycles,
    profiles,
    autoApplyHighConfidence: false,
  })

  if ((existingItems ?? []).length > 0) {
    const { error: deleteError } = await supabase
      .from('availability_email_intake_items')
      .delete()
      .eq('intake_id', intakeId)

    if (deleteError) {
      console.error('Failed to clear old intake items before reparsing:', deleteError)
      redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_reparse_failed' }))
    }
  }

  if (parsedBatch.items.length > 0) {
    const { error: insertError } = await supabase.from('availability_email_intake_items').insert(
      parsedBatch.items.map((item) => ({
        intake_id: intakeId,
        source_type: item.sourceType,
        source_label: item.sourceLabel,
        attachment_id: item.attachmentId,
        raw_text: item.rawText || null,
        ocr_status: item.ocrStatus,
        ocr_model: item.ocrModel,
        ocr_error: item.ocrError,
        parse_status: item.parseStatus,
        confidence_level: item.confidenceLevel,
        confidence_reasons: item.confidenceReasons,
        extracted_employee_name: item.extractedEmployeeName,
        employee_match_candidates: item.employeeMatchCandidates,
        matched_therapist_id: item.matchedTherapistId,
        matched_cycle_id: item.matchedCycleId,
        original_parsed_requests: item.requests,
        parsed_requests: item.requests,
        unresolved_lines: item.unresolvedLines,
        manually_edited_at: null,
        auto_applied_at: null,
        auto_applied_by: null,
        apply_error: null,
      }))
    )

    if (insertError) {
      console.error('Failed to insert reparsed intake items:', insertError)
      redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_reparse_failed' }))
    }
  }

  const { error: intakeUpdateError } = await supabase
    .from('availability_email_intakes')
    .update({
      parse_status: parsedBatch.batchStatus,
      batch_status: parsedBatch.batchStatus,
      parse_summary: parsedBatch.batchSummary.summary,
      parsed_requests: parsedBatch.items.flatMap((item) => item.requests),
      item_count: parsedBatch.batchSummary.itemCount,
      auto_applied_count: parsedBatch.batchSummary.autoAppliedCount,
      needs_review_count: parsedBatch.batchSummary.needsReviewCount,
      failed_count: parsedBatch.batchSummary.failedCount,
    })
    .eq('id', intakeId)

  if (intakeUpdateError) {
    console.error('Failed to update intake summary after reparsing:', intakeUpdateError)
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_reparse_failed' }))
  }

  revalidatePath('/availability')
  redirect(buildEmailIntakeAvailabilityUrl({ success: 'email_intake_reparsed' }))
}

export async function deleteEmailIntakeAction(formData: FormData) {
  const { supabase, role } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui')) {
    redirect('/availability')
  }

  const intakeId = String(formData.get('intake_id') ?? '').trim()
  if (!intakeId) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_delete_failed' }))
  }

  const { error } = await supabase.from('availability_email_intakes').delete().eq('id', intakeId)

  if (error) {
    console.error('Failed to delete availability email intake:', error)
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_delete_failed' }))
  }

  revalidatePath('/availability')
  redirect(buildEmailIntakeAvailabilityUrl({ success: 'email_intake_deleted' }))
}

// Backward-compatible aliases for existing imports.
export const reparseAvailabilityEmailIntakeAction = reparseEmailIntakeAction
export const deleteAvailabilityEmailIntakeAction = deleteEmailIntakeAction

export async function copyAvailabilityFromPreviousCycleAction(formData: FormData) {
  const { supabase, user, role } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui')) {
    redirect('/availability')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const therapistId = String(formData.get('therapist_id') ?? '').trim()

  if (!cycleId || !therapistId) {
    redirect('/availability')
  }

  const noSourceUrl = buildAvailabilityUrl({
    error: 'copy_no_source',
    cycle: cycleId,
    therapist: therapistId,
  })

  const { data: targetCycle } = await supabase
    .from('schedule_cycles')
    .select('start_date, end_date')
    .eq('id', cycleId)
    .maybeSingle()

  if (!targetCycle) {
    redirect(noSourceUrl)
  }

  const { data: sourceCycleRows } = await supabase
    .from('availability_overrides')
    .select('cycle_id, schedule_cycles(start_date, end_date)')
    .eq('therapist_id', therapistId)
    .eq('source', 'manager')
    .neq('cycle_id', cycleId)
    .order('created_at', { ascending: false })
    .limit(1)

  const rawSourceRow = (sourceCycleRows ?? [])[0] as
    | {
        cycle_id: string
        schedule_cycles:
          | { start_date: string; end_date: string }
          | Array<{ start_date: string; end_date: string }>
          | null
      }
    | undefined
  const sourceCycle =
    rawSourceRow == null
      ? null
      : Array.isArray(rawSourceRow.schedule_cycles)
        ? (rawSourceRow.schedule_cycles[0] ?? null)
        : rawSourceRow.schedule_cycles
  const sourceRow =
    rawSourceRow && sourceCycle
      ? {
          cycle_id: rawSourceRow.cycle_id,
          schedule_cycles: sourceCycle,
        }
      : null

  if (!sourceRow) {
    redirect(noSourceUrl)
  }

  const { data: sourceOverrides } = await supabase
    .from('availability_overrides')
    .select('date, override_type, shift_type, note')
    .eq('cycle_id', sourceRow.cycle_id)
    .eq('therapist_id', therapistId)
    .eq('source', 'manager')

  if (!sourceOverrides || sourceOverrides.length === 0) {
    redirect(noSourceUrl)
  }

  const { data: existingRows } = await supabase
    .from('availability_overrides')
    .select('date')
    .eq('cycle_id', cycleId)
    .eq('therapist_id', therapistId)
    .eq('source', 'manager')

  const shifted = shiftOverridesToCycle({
    sourceOverrides: sourceOverrides.map((row) => ({
      date: String(row.date),
      override_type: row.override_type as AvailabilityOverrideType,
      shift_type: (row.shift_type ?? 'both') as AvailabilityShiftType,
      note: row.note ?? null,
    })),
    sourceCycleStart: sourceRow.schedule_cycles.start_date,
    targetCycleStart: targetCycle.start_date,
    targetCycleEnd: targetCycle.end_date,
    existingTargetDates: new Set((existingRows ?? []).map((row) => String(row.date))),
  })

  if (shifted.length === 0) {
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId,
        therapist: therapistId,
        error: 'copy_nothing_new',
      })
    )
  }

  const payload = shifted.map((row) => ({
    therapist_id: therapistId,
    cycle_id: cycleId,
    date: row.date,
    shift_type: row.shift_type,
    override_type: row.override_type,
    note: row.note,
    created_by: user.id,
    source: 'manager' as const,
  }))

  const { error: upsertError } = await supabase
    .from('availability_overrides')
    .upsert(payload, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

  if (upsertError) {
    console.error('Failed to copy availability overrides:', upsertError)
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId,
        therapist: therapistId,
        error: 'copy_failed',
      })
    )
  }

  revalidatePath('/availability')
  redirect(
    buildAvailabilityUrl({
      cycle: cycleId,
      therapist: therapistId,
      success: 'copy_success',
      copied: String(shifted.length),
    })
  )
}
