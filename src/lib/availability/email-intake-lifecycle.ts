import type { SupabaseClient } from '@supabase/supabase-js'

import {
  type AvailabilityEmailBatchStatus,
  type ParsedAvailabilityEmailBatchItem,
  parseAvailabilityEmailBatchSources,
  sanitizeParsedRequests,
  stripHtmlToText,
  summarizeAvailabilityEmailBatch,
} from '@/lib/availability-email-intake'
import {
  cycleIntakeRequest,
  markRequestsEdited,
  removeIntakeRequest,
} from '@/lib/availability-intake-request-cycler'
import { findBlockingAvailabilityOverwrite } from '@/lib/availability-overwrite-guard'
import { buildManagerOverrideInput } from '@/lib/employee-directory'
import { extractTextFromAttachment } from '@/lib/openai-ocr'

export type AvailabilityEmailItemStatus =
  | 'parsed'
  | 'ready_to_apply'
  | 'applied'
  | 'auto_applied'
  | 'needs_review'
  | 'failed'

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

type EmailIntakeLifecycleResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

type AvailabilityOverrideWrite = {
  cycle_id: string
  therapist_id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  source: 'therapist' | 'manager'
}

async function hasBlockingAvailabilityOverwrite(
  supabase: SupabaseClient,
  payload: AvailabilityOverrideWrite[]
): Promise<boolean> {
  const groups = new Map<string, AvailabilityOverrideWrite[]>()
  for (const row of payload) {
    const key = `${row.cycle_id}|${row.therapist_id}`
    const current = groups.get(key) ?? []
    current.push(row)
    groups.set(key, current)
  }

  for (const rows of groups.values()) {
    const first = rows[0]
    if (!first) continue
    const { data: existingRows, error } = await supabase
      .from('availability_overrides')
      .select('date, shift_type, source')
      .eq('cycle_id', first.cycle_id)
      .eq('therapist_id', first.therapist_id)
      .in('date', [...new Set(rows.map((row) => row.date))])
      .in('shift_type', [...new Set(rows.map((row) => row.shift_type))])

    if (error) {
      console.error('Failed to check email availability overwrite conflicts:', error)
      return true
    }

    const blockingConflict = findBlockingAvailabilityOverwrite(
      existingRows ?? [],
      rows.map((row) => ({
        date: row.date,
        shift_type: row.shift_type,
        source: row.source,
      }))
    )
    if (blockingConflict) return true
  }

  return false
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
        : rows.every((row) => row.parse_status === 'applied' || row.parse_status === 'auto_applied')
          ? 'applied'
          : 'parsed'

  return {
    batchStatus,
    parseSummary: batchSummary.summary,
    parsedRequests: rows.flatMap((row) => sanitizeParsedRequests(row.parsed_requests)),
    itemCount: rows.length,
    autoAppliedCount: rows.filter(
      (row) => row.parse_status === 'applied' || row.parse_status === 'auto_applied'
    ).length,
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

export function buildAvailabilityEmailIntakeItemRows(
  intakeId: string,
  items: ReturnType<typeof parseAvailabilityEmailBatchSources>['items']
) {
  return items.map((item) => ({
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
}

export async function autoApplyReadyAvailabilityEmailIntakeItems(params: {
  supabase: SupabaseClient
  intakeId: string
  parsedItems: ParsedAvailabilityEmailBatchItem[]
  savedItems: Array<{ id: string; parse_status: string }>
}): Promise<EmailIntakeLifecycleResult> {
  const { supabase, intakeId, parsedItems, savedItems } = params
  const readyItemIds = savedItems
    .filter((item) => item.parse_status === 'ready_to_apply')
    .map((item) => item.id)

  if (readyItemIds.length === 0) {
    return { ok: true }
  }

  const now = new Date().toISOString()
  const autoApplyPayload = parsedItems
    .filter(
      (item) =>
        item.parseStatus === 'ready_to_apply' &&
        item.matchedTherapistId &&
        item.matchedCycleId &&
        item.requests.length > 0
    )
    .flatMap((item) =>
      item.requests.map((request) => ({
        cycle_id: item.matchedCycleId!,
        therapist_id: item.matchedTherapistId!,
        date: request.date,
        shift_type: request.shift_type,
        override_type: request.override_type,
        note: request.note ?? `Imported from ${item.sourceLabel}: ${request.source_line}`,
        created_by: item.matchedTherapistId!,
        source: 'therapist' as const,
        intent: 'email_intake' as const,
      }))
    )

  if (autoApplyPayload.length === 0) {
    return { ok: true }
  }

  const hasOverwriteConflict = await hasBlockingAvailabilityOverwrite(supabase, autoApplyPayload)

  const { error: applyError } = hasOverwriteConflict
    ? { error: { message: 'availability_overwrite_conflict' } }
    : await supabase
        .from('availability_overrides')
        .upsert(autoApplyPayload, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

  const finalParsedItems = parsedItems.map((item) =>
    item.parseStatus === 'ready_to_apply'
      ? {
          ...item,
          parseStatus: applyError ? ('needs_review' as const) : ('applied' as const),
        }
      : item
  )
  const finalSummary = summarizeAvailabilityEmailBatch(finalParsedItems)
  const finalBatchStatus: AvailabilityEmailBatchStatus = applyError
    ? 'needs_review'
    : finalParsedItems.every(
          (item) => item.parseStatus === 'applied' || item.parseStatus === 'auto_applied'
        )
      ? 'applied'
      : finalParsedItems.some((item) => item.parseStatus === 'needs_review')
        ? 'needs_review'
        : 'parsed'

  if (applyError) {
    console.error('Failed to auto-apply inbound availability items:', applyError)
    const { error: itemUpdateError } = await supabase
      .from('availability_email_intake_items')
      .update({
        parse_status: 'needs_review',
        apply_error: applyError.message ?? 'auto_apply_failed',
      })
      .in('id', readyItemIds)

    if (itemUpdateError) {
      console.error('Failed to mark auto-apply intake items for review:', itemUpdateError)
      return { ok: false, error: 'email_intake_auto_apply_failed' }
    }
  } else {
    const { error: itemUpdateError } = await supabase
      .from('availability_email_intake_items')
      .update({
        parse_status: 'applied',
        applied_at: now,
        apply_method: 'auto',
        auto_applied_at: now,
        apply_error: null,
      })
      .in('id', readyItemIds)

    if (itemUpdateError) {
      console.error('Failed to mark auto-apply intake items as applied:', itemUpdateError)
      return { ok: false, error: 'email_intake_auto_apply_failed' }
    }
  }

  const { error: intakeUpdateError } = await supabase
    .from('availability_email_intakes')
    .update({
      parse_status: finalBatchStatus,
      batch_status: finalBatchStatus,
      parse_summary: finalSummary.summary,
      parsed_requests: finalParsedItems.flatMap((item) => item.requests),
      auto_applied_count: finalSummary.autoAppliedCount,
      needs_review_count: finalSummary.needsReviewCount,
      failed_count: finalSummary.failedCount,
      applied_at: applyError ? null : now,
      applied_by: null,
    })
    .eq('id', intakeId)

  if (intakeUpdateError) {
    console.error('Failed to update intake summary after auto-apply:', intakeUpdateError)
    return { ok: false, error: 'email_intake_auto_apply_failed' }
  }

  return { ok: true }
}

export async function applyAvailabilityEmailImport(params: {
  supabase: SupabaseClient
  userId: string
  itemId: string
  intakeId: string
}): Promise<EmailIntakeLifecycleResult<{ cycleId: string; therapistId: string }>> {
  const { supabase, userId, itemId, intakeId } = params
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
      return { ok: false, error: 'email_intake_apply_failed' }
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
      return { ok: false, error: 'email_intake_apply_failed' }
    }

    matchedTherapistId = intake.matched_therapist_id
    matchedCycleId = intake.matched_cycle_id
    parsedRequests = sanitizeParsedRequests(intake.parsed_requests)
  }

  if (!matchedTherapistId || !matchedCycleId || parsedRequests.length === 0) {
    return { ok: false, error: 'email_intake_apply_failed' }
  }

  const payload = parsedRequests.map((request) =>
    buildManagerOverrideInput({
      cycleId: matchedCycleId,
      therapistId: matchedTherapistId,
      date: request.date,
      shiftType: request.shift_type,
      overrideType: request.override_type,
      note: request.note ?? `Imported from email: ${request.source_line}`,
      managerId: userId,
      intent: 'email_intake',
    })
  )

  if (await hasBlockingAvailabilityOverwrite(supabase, payload)) {
    return { ok: false, error: 'email_intake_availability_conflict' }
  }

  const { error: upsertError } = await supabase
    .from('availability_overrides')
    .upsert(payload, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

  if (upsertError) {
    console.error('Failed to apply availability email intake:', upsertError)
    return { ok: false, error: 'email_intake_apply_failed' }
  }

  const now = new Date().toISOString()
  if (itemId) {
    const { error: itemUpdateError } = await supabase
      .from('availability_email_intake_items')
      .update({
        parse_status: 'applied',
        applied_at: now,
        applied_by: userId,
        apply_method: 'manual',
        auto_applied_at: now,
        auto_applied_by: userId,
        apply_error: null,
      })
      .eq('id', itemId)

    if (itemUpdateError) {
      console.error('Failed to mark availability email intake item as applied:', itemUpdateError)
      return { ok: false, error: 'email_intake_apply_failed' }
    }
  } else {
    const { error: updateError } = await supabase
      .from('availability_email_intakes')
      .update({
        parse_status: 'applied',
        batch_status: 'applied',
        applied_at: now,
        applied_by: userId,
      })
      .eq('id', intakeId)

    if (updateError) {
      console.error('Failed to mark availability email intake as applied:', updateError)
      return { ok: false, error: 'email_intake_apply_failed' }
    }
  }

  if (itemId && effectiveIntakeId) {
    await refreshAvailabilityEmailIntakeBatchState(supabase, effectiveIntakeId)
  }

  return { ok: true, cycleId: matchedCycleId, therapistId: matchedTherapistId }
}

export async function updateEmailIntakeTherapistMatch(params: {
  supabase: SupabaseClient
  itemId: string
  intakeId: string
  therapistId: string
  cycleId: string
}): Promise<EmailIntakeLifecycleResult> {
  const { supabase, itemId, intakeId, therapistId, cycleId } = params

  if (itemId) {
    const { data: item, error: loadError } = await supabase
      .from('availability_email_intake_items')
      .select('intake_id, parsed_requests')
      .eq('id', itemId)
      .maybeSingle()

    if (loadError || !item) {
      console.error('Failed to load intake item for therapist update:', loadError)
      return { ok: false, error: 'email_intake_match_failed' }
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
      return { ok: false, error: 'email_intake_match_failed' }
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
      return { ok: false, error: 'email_intake_match_failed' }
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
      return { ok: false, error: 'email_intake_match_failed' }
    }
  }

  return { ok: true }
}

export async function updateEmailIntakeItemRequest(params: {
  supabase: SupabaseClient
  itemId: string
  date: string
  overrideType: 'force_off' | 'force_on'
  shiftType: 'day' | 'night' | 'both'
  mode: 'cycle' | 'remove'
}): Promise<EmailIntakeLifecycleResult> {
  const { supabase, itemId, date, overrideType, shiftType, mode } = params
  const { data: item, error: loadError } = await supabase
    .from('availability_email_intake_items')
    .select(
      'id, intake_id, parsed_requests, original_parsed_requests, matched_therapist_id, matched_cycle_id'
    )
    .eq('id', itemId)
    .maybeSingle()

  if (loadError || !item) {
    console.error('Failed to load intake item for request update:', loadError)
    return { ok: false, error: 'email_intake_request_update_failed' }
  }

  const chipTarget = {
    date,
    override_type: overrideType,
    shift_type: shiftType,
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
        manually_edited_at: markRequestsEdited({
          originalRequests: item.original_parsed_requests,
          currentRequests: parsedRequests,
        })
          ? new Date().toISOString()
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
    return { ok: false, error: 'email_intake_request_update_failed' }
  }

  if (item.intake_id) {
    await refreshAvailabilityEmailIntakeBatchState(supabase, String(item.intake_id))
  }

  return { ok: true }
}

export async function reparseAvailabilityEmailIntake(
  supabase: SupabaseClient,
  intakeId: string
): Promise<EmailIntakeLifecycleResult> {
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
    return { ok: false, error: 'email_intake_reparse_failed' }
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
      return { ok: false, error: 'email_intake_reparse_failed' }
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
      return { ok: false, error: 'email_intake_reparse_failed' }
    }
  }

  if (parsedBatch.items.length > 0) {
    const { error: insertError } = await supabase
      .from('availability_email_intake_items')
      .insert(buildAvailabilityEmailIntakeItemRows(intakeId, parsedBatch.items))

    if (insertError) {
      console.error('Failed to insert reparsed intake items:', insertError)
      return { ok: false, error: 'email_intake_reparse_failed' }
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
    return { ok: false, error: 'email_intake_reparse_failed' }
  }

  return { ok: true }
}

export async function deleteAvailabilityEmailIntake(
  supabase: SupabaseClient,
  intakeId: string
): Promise<EmailIntakeLifecycleResult> {
  const { error } = await supabase.from('availability_email_intakes').delete().eq('id', intakeId)

  if (error) {
    console.error('Failed to delete availability email intake:', error)
    return { ok: false, error: 'email_intake_delete_failed' }
  }

  return { ok: true }
}
