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
  summarizeAvailabilityEmailBatch,
  sanitizeParsedRequests,
} from '@/lib/availability-email-intake'
import { shiftOverridesToCycle } from '@/lib/copy-cycle-availability'
import { buildManagerOverrideInput } from '@/lib/employee-directory'
import { resolveTherapistAvailabilityWritePermission } from '@/lib/therapist-availability-submission'
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
    throw loadError
  }

  if (!existing) {
    const { error } = await supabase.from('therapist_availability_submissions').insert({
      therapist_id: therapistId,
      schedule_cycle_id: cycleId,
      submitted_at: now,
      last_edited_at: now,
    })
    if (error) {
      if (error.code === '23505') {
        const { error: retryUpdateError } = await supabase
          .from('therapist_availability_submissions')
          .update({ last_edited_at: now })
          .eq('therapist_id', therapistId)
          .eq('schedule_cycle_id', cycleId)

        if (!retryUpdateError) {
          return
        }
        throw retryUpdateError
      }

      throw error
    }
    return
  }

  const { error } = await supabase
    .from('therapist_availability_submissions')
    .update({ last_edited_at: now })
    .eq('therapist_id', therapistId)
    .eq('schedule_cycle_id', cycleId)

  if (error) {
    throw error
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

async function loadTherapistCycleWriteContext(
  supabase: SupabaseClient,
  therapistId: string,
  cycleId: string,
  returnPath: '/availability' | '/therapist/availability'
) {
  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('start_date, end_date, availability_due_at, archived_at')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError) {
    console.error('Failed to load availability cycle for therapist write:', cycleError)
    redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
  }

  if (!cycle || cycle.archived_at) {
    redirect(buildAvailabilityUrl({ error: 'submission_closed', cycle: cycleId }, returnPath))
  }

  const { data: existingSubmission, error: submissionError } = await supabase
    .from('therapist_availability_submissions')
    .select('id')
    .eq('therapist_id', therapistId)
    .eq('schedule_cycle_id', cycleId)
    .maybeSingle()

  if (submissionError) {
    console.error(
      'Failed to load therapist availability submission state before write:',
      submissionError
    )
    redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
  }

  const writePermission = resolveTherapistAvailabilityWritePermission(
    {
      start_date: cycle.start_date,
      end_date: cycle.end_date,
      availability_due_at: cycle.availability_due_at,
    },
    Boolean(existingSubmission)
  )

  if (!writePermission.allowed) {
    redirect(buildAvailabilityUrl({ error: 'submission_closed', cycle: cycleId }, returnPath))
  }

  return {
    cycle: {
      start_date: cycle.start_date,
      end_date: cycle.end_date,
      availability_due_at: cycle.availability_due_at,
    },
  }
}

type AvailabilityOverrideType = 'force_off' | 'force_on'
type AvailabilityShiftType = 'day' | 'night' | 'both'
type AvailabilityEmailItemStatus = 'parsed' | 'auto_applied' | 'needs_review' | 'failed'

type AvailabilityEmailItemSummaryRow = {
  parse_status: AvailabilityEmailItemStatus
  parsed_requests: unknown
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

  await loadTherapistCycleWriteContext(supabase, user.id, cycleId, returnPath)

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

  try {
    await upsertTherapistSubmissionAfterOfficialSave(supabase, user.id, cycleId)
  } catch (error) {
    console.error('Failed to persist official therapist availability submission:', error)
    redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
  }

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

  const { cycle } = await loadTherapistCycleWriteContext(supabase, user.id, cycleId, returnPath)

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
    try {
      await upsertTherapistSubmissionAfterOfficialSave(supabase, user.id, cycleId)
    } catch (error) {
      console.error('Failed to persist official therapist availability submission:', error)
      redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
    }
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

  if (cycleId) {
    await loadTherapistCycleWriteContext(supabase, user.id, cycleId, returnPath)
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
    redirect(buildAvailabilityUrl({ error: 'email_intake_apply_failed' }))
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
      redirect(buildAvailabilityUrl({ error: 'email_intake_apply_failed' }))
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
      redirect(buildAvailabilityUrl({ error: 'email_intake_apply_failed' }))
    }

    matchedTherapistId = intake.matched_therapist_id
    matchedCycleId = intake.matched_cycle_id
    parsedRequests = sanitizeParsedRequests(intake.parsed_requests)
  }

  if (!matchedTherapistId || !matchedCycleId) {
    redirect(buildAvailabilityUrl({ error: 'email_intake_apply_failed' }))
  }

  if (parsedRequests.length === 0) {
    redirect(buildAvailabilityUrl({ error: 'email_intake_apply_failed' }))
  }

  const payload = parsedRequests.map((request) =>
    buildManagerOverrideInput({
      cycleId: matchedCycleId,
      therapistId: matchedTherapistId,
      date: request.date,
      shiftType: request.shift_type,
      overrideType: request.override_type,
      note: request.note ?? `Imported from email: ${request.source_line}`,
      managerId: user.id,
    })
  )

  const { error: upsertError } = await supabase
    .from('availability_overrides')
    .upsert(payload, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

  if (upsertError) {
    console.error('Failed to apply availability email intake:', upsertError)
    redirect(buildAvailabilityUrl({ error: 'email_intake_apply_failed' }))
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
      redirect(buildAvailabilityUrl({ error: 'email_intake_apply_failed' }))
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
      redirect(buildAvailabilityUrl({ error: 'email_intake_apply_failed' }))
    }
  }

  if (itemId && effectiveIntakeId) {
    await refreshAvailabilityEmailIntakeBatchState(supabase, effectiveIntakeId)
  }

  revalidatePath('/availability')
  redirect(buildAvailabilityUrl({ success: 'email_intake_applied' }))
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
    redirect(buildAvailabilityUrl({ error: 'email_intake_match_failed' }))
  }

  if (itemId) {
    const { data: item, error: loadError } = await supabase
      .from('availability_email_intake_items')
      .select('intake_id, parsed_requests')
      .eq('id', itemId)
      .maybeSingle()

    if (loadError || !item) {
      console.error('Failed to load intake item for therapist update:', loadError)
      redirect(buildAvailabilityUrl({ error: 'email_intake_match_failed' }))
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
      redirect(buildAvailabilityUrl({ error: 'email_intake_match_failed' }))
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
      redirect(buildAvailabilityUrl({ error: 'email_intake_match_failed' }))
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
      redirect(buildAvailabilityUrl({ error: 'email_intake_match_failed' }))
    }
  }

  revalidatePath('/availability')
  redirect(buildAvailabilityUrl({ success: 'email_intake_match_saved' }))
}

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
