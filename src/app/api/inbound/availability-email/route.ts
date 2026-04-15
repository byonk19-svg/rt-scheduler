import { after, NextResponse } from 'next/server'

import {
  parseAvailabilityEmailBatchSources,
  parseSender,
  stripHtmlToText,
  type IntakeCycle,
  type AvailabilityEmailAttachmentSource,
} from '@/lib/availability-email-intake'
import { extractTextFromAttachment } from '@/lib/openai-ocr'
import { isValidResendWebhookRequest } from '@/lib/security/resend-webhook'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

const RESEND_RECEIVING_API_URL = 'https://api.resend.com/emails/receiving'
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024

type ResendWebhookPayload = {
  type?: string
  data?: {
    email_id?: string
  }
}

type ResendEmailContent = {
  id?: string
  from?: string | { email?: string | null; name?: string | null } | null
  subject?: string | null
  text?: string | null
  text_content?: string | null
  html?: string | null
  html_content?: string | null
  created_at?: string | null
  message_id?: string | null
}

type ResendAttachmentRecord = {
  id: string
  filename: string
  content_type: string
  content_disposition: string | null
  size_bytes: number | null
  content_base64: string | null
  download_status: 'stored' | 'skipped' | 'failed'
  download_error: string | null
  ocr_status: 'not_run' | 'completed' | 'failed' | 'skipped'
  ocr_text: string | null
  ocr_model: string | null
  ocr_error: string | null
}

function getResendApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY for inbound availability email processing.')
  }
  return apiKey
}

async function resendFetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${RESEND_RECEIVING_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${getResendApiKey()}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Resend request failed (${response.status}): ${details}`)
  }

  return (await response.json()) as T
}

async function fetchReceivedEmail(emailId: string): Promise<ResendEmailContent> {
  return resendFetchJson<ResendEmailContent | { data?: ResendEmailContent }>(`/${emailId}`).then(
    (payload) => {
      if ('data' in payload && payload.data) {
        return payload.data
      }
      return payload as ResendEmailContent
    }
  )
}

async function listReceivedEmailAttachments(
  emailId: string
): Promise<Array<Record<string, unknown>>> {
  return resendFetchJson<
    Array<Record<string, unknown>> | { data?: Array<Record<string, unknown>> }
  >(`/${emailId}/attachments`).then((payload) =>
    Array.isArray(payload) ? payload : (payload.data ?? [])
  )
}

async function downloadAttachment(url: string): Promise<{
  contentBase64: string | null
  status: 'stored' | 'skipped' | 'failed'
  error: string | null
  sizeBytes: number | null
}> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getResendApiKey()}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    return {
      contentBase64: null,
      status: 'failed',
      error: `Attachment download failed (${response.status}).`,
      sizeBytes: null,
    }
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
    return {
      contentBase64: null,
      status: 'skipped',
      error: `Attachment exceeds ${MAX_ATTACHMENT_BYTES} byte limit.`,
      sizeBytes: buffer.byteLength,
    }
  }

  return {
    contentBase64: Buffer.from(buffer).toString('base64'),
    status: 'stored',
    error: null,
    sizeBytes: buffer.byteLength,
  }
}

function normalizeEmailText(email: ResendEmailContent): string {
  const parts = [
    email.subject ?? '',
    email.text ?? email.text_content ?? '',
    stripHtmlToText(email.html ?? email.html_content ?? ''),
  ]

  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join('\n')
}

function resolveSender(rawFrom: ResendEmailContent['from']): {
  email: string | null
  name: string | null
} {
  if (!rawFrom) return { email: null, name: null }
  if (typeof rawFrom === 'string') return parseSender(rawFrom)

  const email = typeof rawFrom.email === 'string' ? rawFrom.email.trim().toLowerCase() : null
  const name = typeof rawFrom.name === 'string' ? rawFrom.name.trim() || null : null
  return { email, name }
}

function flattenBatchRequests(items: Array<{ requests: Array<Record<string, unknown>> }>) {
  return items.flatMap((item) => item.requests)
}

function inferAttachmentContentType(params: { filename: string; contentType: string }): string {
  const normalized = params.contentType.toLowerCase()
  if (normalized !== 'application/octet-stream' && normalized !== 'binary/octet-stream') {
    return params.contentType
  }
  const lowerName = params.filename.toLowerCase()
  if (lowerName.endsWith('.pdf')) return 'application/pdf'
  return params.contentType
}

async function processInboundAvailabilityEmail(emailId: string) {
  const admin = createAdminClient()
  const [emailContent, attachmentRecords] = await Promise.all([
    fetchReceivedEmail(emailId),
    listReceivedEmailAttachments(emailId),
  ])
  const sender = resolveSender(emailContent.from)

  const { data: activeProfiles } = await admin
    .from('profiles')
    .select('id, full_name, is_active')
    .in('role', ['therapist', 'lead'])
    .eq('is_active', true)
    .is('archived_at', null)
    .order('full_name', { ascending: true })

  const todayKey = new Date().toISOString().slice(0, 10)
  const { data: cycleRows } = await admin
    .from('schedule_cycles')
    .select('id, label, start_date, end_date')
    .is('archived_at', null)
    .gte('end_date', todayKey)
    .order('start_date', { ascending: true })

  const cycles = ((cycleRows ?? []) as IntakeCycle[]).filter(
    (cycle) => cycle.start_date && cycle.end_date
  )
  const processedAttachments: ResendAttachmentRecord[] = []

  for (const [index, attachment] of attachmentRecords.entries()) {
    const attachmentId =
      typeof attachment.id === 'string' ? attachment.id.trim() : `generated-${emailId}-${index + 1}`
    const filename =
      typeof attachment.filename === 'string'
        ? attachment.filename.trim()
        : typeof attachment.name === 'string'
          ? String(attachment.name).trim()
          : 'attachment'
    const rawContentType =
      typeof attachment.content_type === 'string'
        ? attachment.content_type
        : typeof attachment.type === 'string'
          ? attachment.type
          : 'application/octet-stream'
    const contentType = inferAttachmentContentType({
      filename,
      contentType: rawContentType,
    })
    const downloadUrl =
      typeof attachment.url === 'string'
        ? attachment.url
        : typeof attachment.download_url === 'string'
          ? attachment.download_url
          : null

    const downloaded = downloadUrl
      ? await downloadAttachment(downloadUrl)
      : {
          contentBase64: null,
          status: 'failed' as const,
          error: 'Attachment download URL missing.',
          sizeBytes: null,
        }

    const attachmentRow: ResendAttachmentRecord = {
      id: attachmentId,
      filename,
      content_type: contentType,
      content_disposition:
        typeof attachment.content_disposition === 'string' ? attachment.content_disposition : null,
      size_bytes:
        typeof attachment.size === 'number'
          ? attachment.size
          : typeof attachment.size_bytes === 'number'
            ? attachment.size_bytes
            : downloaded.sizeBytes,
      content_base64: downloaded.contentBase64,
      download_status: downloaded.status,
      download_error: downloaded.error,
      ocr_status: 'not_run',
      ocr_text: null,
      ocr_model: null,
      ocr_error: null,
    }
    const ocrResult = await extractTextFromAttachment({
      contentBase64: attachmentRow.content_base64,
      contentType: attachmentRow.content_type,
      filename: attachmentRow.filename,
    })
    attachmentRow.ocr_status = ocrResult.status
    attachmentRow.ocr_text = ocrResult.text
    attachmentRow.ocr_model = ocrResult.model
    attachmentRow.ocr_error = ocrResult.error

    processedAttachments.push(attachmentRow)
  }

  const attachmentSources: AvailabilityEmailAttachmentSource[] = processedAttachments.map(
    (attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      rawText: attachment.ocr_text,
      ocrStatus: attachment.ocr_status,
      ocrModel: attachment.ocr_model,
      ocrError: attachment.ocr_error ?? attachment.download_error,
    })
  )

  const parsedBatch = parseAvailabilityEmailBatchSources({
    normalizedBodyText: normalizeEmailText(emailContent),
    attachments: attachmentSources,
    cycles,
    profiles:
      ((activeProfiles ?? []) as Array<{
        id: string
        full_name: string
        is_active?: boolean | null
      }>) ?? [],
    autoApplyHighConfidence: true,
  })
  const parsedItems = parsedBatch.items
  const batchSummary = parsedBatch.batchSummary
  const batchStatus = parsedBatch.batchStatus
  const intakeInsert = {
    provider: 'resend',
    provider_email_id: emailId,
    provider_message_id: emailContent.message_id ?? null,
    from_email: sender.email ?? 'unknown@unknown.invalid',
    from_name: sender.name,
    subject: emailContent.subject ?? null,
    text_content: normalizeEmailText(emailContent) || null,
    html_content: emailContent.html ?? emailContent.html_content ?? null,
    received_at: emailContent.created_at ?? new Date().toISOString(),
    matched_therapist_id: null,
    matched_cycle_id: null,
    parse_status: batchStatus,
    batch_status: batchStatus,
    parse_summary: batchSummary.summary,
    parsed_requests: flattenBatchRequests(parsedItems),
    item_count: batchSummary.itemCount,
    auto_applied_count: batchSummary.autoAppliedCount,
    needs_review_count: batchSummary.needsReviewCount,
    failed_count: batchSummary.failedCount,
    raw_payload: {
      type: 'email.received',
      data: { email_id: emailId },
    },
  }

  const { data: savedIntake, error: intakeError } = await admin
    .from('availability_email_intakes')
    .upsert(intakeInsert, { onConflict: 'provider_email_id' })
    .select('id')
    .single()

  if (intakeError || !savedIntake) {
    throw new Error(`Could not store intake: ${intakeError?.message ?? 'unknown error'}`)
  }

  for (const attachmentRow of processedAttachments) {
    await admin.from('availability_email_attachments').upsert(
      {
        intake_id: savedIntake.id,
        provider_attachment_id: attachmentRow.id,
        filename: attachmentRow.filename,
        content_type: attachmentRow.content_type,
        content_disposition: attachmentRow.content_disposition,
        size_bytes: attachmentRow.size_bytes,
        content_base64: attachmentRow.content_base64,
        download_status: attachmentRow.download_status,
        download_error: attachmentRow.download_error,
        ocr_status: attachmentRow.ocr_status,
        ocr_text: attachmentRow.ocr_text,
        ocr_model: attachmentRow.ocr_model,
        ocr_error: attachmentRow.ocr_error,
      },
      { onConflict: 'provider_attachment_id' }
    )
  }

  if (parsedItems.length > 0) {
    await admin.from('availability_email_intake_items').insert(
      parsedItems.map((item) => ({
        intake_id: savedIntake.id,
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
        auto_applied_at: item.parseStatus === 'auto_applied' ? new Date().toISOString() : null,
        auto_applied_by: null,
        apply_error: null,
      }))
    )
  }

  const autoApplyPayload = parsedItems
    .filter(
      (item) =>
        item.parseStatus === 'auto_applied' &&
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
        created_by: null,
        source: 'manager' as const,
      }))
    )

  if (autoApplyPayload.length > 0) {
    const { error: applyError } = await admin
      .from('availability_overrides')
      .upsert(autoApplyPayload, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

    if (applyError) {
      console.error('Failed to auto-apply inbound availability items:', applyError)
    }
  }

  return {
    intakeId: savedIntake.id,
    batchStatus,
    batchSummary,
    parsedItems,
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  if (!(await isValidResendWebhookRequest(request, rawBody))) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 })
  }

  let payload: ResendWebhookPayload
  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 })
  }

  if (payload.type !== 'email.received') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const emailId = payload.data?.email_id?.trim()
  if (!emailId) {
    return NextResponse.json({ error: 'Missing email id.' }, { status: 400 })
  }

  after(async () => {
    try {
      await processInboundAvailabilityEmail(emailId)
    } catch (error) {
      console.error('Failed to process inbound availability email:', error)
    }
  })

  return NextResponse.json({ ok: true, queued: true, email_id: emailId })
}
