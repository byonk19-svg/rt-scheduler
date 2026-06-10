import { after, NextResponse } from 'next/server'

import {
  parseAvailabilityEmailBatchSources,
  parseSender,
  summarizeAvailabilityEmailBatch,
  stripHtmlToText,
  type AvailabilityEmailBatchStatus,
  type IntakeCycle,
  type AvailabilityEmailAttachmentSource,
  type ParsedAvailabilityEmailItem,
} from '@/lib/availability-email-intake'
import {
  autoApplyReadyAvailabilityEmailIntakeItems,
  buildAvailabilityEmailIntakeItemRows,
} from '@/lib/availability/email-intake-lifecycle'
import { extractTextFromAttachment } from '@/lib/openai-ocr'
import { isValidResendWebhookRequest } from '@/lib/security/resend-webhook'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'

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

type MatchableProfile = {
  id: string
  full_name: string
  email: string | null
  is_active: boolean | null
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

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function buildItemParseStatus(
  item: ParsedAvailabilityEmailItem,
  senderTrustedForMatchedTherapist: boolean
): ParsedAvailabilityEmailItem['parseStatus'] {
  if (
    item.confidenceLevel === 'high' &&
    item.matchedTherapistId &&
    item.matchedCycleId &&
    item.requests.length > 0
  ) {
    return senderTrustedForMatchedTherapist ? 'ready_to_apply' : 'needs_review'
  }

  return item.parseStatus
}

function isTrustedSenderForMatchedTherapist(params: {
  senderEmail: string | null
  matchedTherapistId: string | null
  therapistEmailById: Map<string, string | null>
}): boolean {
  if (!params.senderEmail || !params.matchedTherapistId) return false
  return params.therapistEmailById.get(params.matchedTherapistId) === params.senderEmail
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
    .select('id, full_name, email, is_active')
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
  const therapistEmailById = new Map(
    (((activeProfiles ?? []) as MatchableProfile[]) ?? []).map((profile) => [
      profile.id,
      normalizeEmail(profile.email ?? null),
    ])
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
    profiles: ((activeProfiles ?? []) as MatchableProfile[]) ?? [],
    autoApplyHighConfidence: true,
  })
  const parsedItems = parsedBatch.items.map((parsedItem) => {
    const senderTrustedForMatchedTherapist = isTrustedSenderForMatchedTherapist({
      senderEmail: sender.email,
      matchedTherapistId: parsedItem.matchedTherapistId,
      therapistEmailById,
    })
    const confidenceReasons =
      !senderTrustedForMatchedTherapist &&
      parsedItem.confidenceLevel === 'high' &&
      parsedItem.matchedTherapistId &&
      parsedItem.matchedCycleId &&
      parsedItem.requests.length > 0
        ? [
            ...parsedItem.confidenceReasons,
            'Sender email does not match the matched therapist profile.',
          ]
        : parsedItem.confidenceReasons

    return {
      ...parsedItem,
      confidenceReasons,
      parseStatus: buildItemParseStatus(parsedItem, senderTrustedForMatchedTherapist),
    }
  })
  const batchSummary = summarizeAvailabilityEmailBatch(parsedItems)
  const batchStatus: AvailabilityEmailBatchStatus =
    parsedItems.length === 0
      ? 'failed'
      : parsedItems.every((item) => item.parseStatus === 'failed')
        ? 'failed'
        : parsedItems.some((item) => item.parseStatus === 'needs_review')
          ? 'needs_review'
          : 'parsed'
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
    parsed_requests: flattenBatchRequests(parsedItems) as Json,
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
    .maybeSingle()

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
    const { data: savedItemRows, error: itemInsertError } = await admin
      .from('availability_email_intake_items')
      .insert(
        buildAvailabilityEmailIntakeItemRows(savedIntake.id, parsedItems).map((row) => ({
          ...row,
          original_parsed_requests: row.original_parsed_requests as Json,
          parsed_requests: row.parsed_requests as Json,
          unresolved_lines: row.unresolved_lines as Json,
          applied_at: null,
          applied_by: null,
          apply_method: null,
        }))
      )
      .select('id, parse_status')

    if (itemInsertError) {
      throw new Error(`Could not store intake items: ${itemInsertError.message}`)
    }

    const autoApplyResult = await autoApplyReadyAvailabilityEmailIntakeItems({
      supabase: admin,
      intakeId: savedIntake.id,
      parsedItems,
      savedItems: (savedItemRows ?? []) as Array<{ id: string; parse_status: string }>,
    })

    if (!autoApplyResult.ok) {
      throw new Error(`Could not auto-apply intake items: ${autoApplyResult.error}`)
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

  const webhookId = request.headers.get('svix-id')?.trim()
  if (!webhookId) {
    return NextResponse.json({ error: 'Missing webhook id.' }, { status: 400 })
  }

  const receiptAdmin = createAdminClient()
  const { error: receiptError } = await receiptAdmin.from('resend_webhook_receipts').insert({
    svix_id: webhookId,
    event_type: payload.type,
    email_id: emailId,
  })

  if (receiptError) {
    if (receiptError.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true, email_id: emailId })
    }

    console.error('Failed to record inbound Resend webhook receipt:', receiptError)
    return NextResponse.json({ error: 'Could not queue webhook.' }, { status: 500 })
  }

  after(async () => {
    try {
      await processInboundAvailabilityEmail(emailId)
      await receiptAdmin
        .from('resend_webhook_receipts')
        .update({ processed_at: new Date().toISOString() })
        .eq('svix_id', webhookId)
    } catch (error) {
      console.error('Failed to process inbound availability email:', error)
    }
  })

  return NextResponse.json({ ok: true, queued: true, email_id: emailId })
}
