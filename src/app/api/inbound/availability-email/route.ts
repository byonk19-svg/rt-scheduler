import { NextResponse } from 'next/server'

import {
  parseAvailabilityEmail,
  parseSender,
  stripHtmlToText,
  type IntakeCycle,
} from '@/lib/availability-email-intake'
import { extractTextFromImageAttachment } from '@/lib/openai-ocr'
import { isValidResendWebhookRequest } from '@/lib/security/resend-webhook'
import { createAdminClient } from '@/lib/supabase/admin'

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

function mergeSources(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0)
    .join('\n\n')
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

function buildParseSummary(
  baseSummary: string,
  options: { therapistMatched: boolean; cycleMatched: boolean }
): string {
  const parts = [baseSummary]
  if (!options.therapistMatched) {
    parts.push('sender did not match an employee email')
  }
  if (!options.cycleMatched) {
    parts.push('cycle could not be resolved automatically')
  }
  return parts.join(' | ')
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

  let admin
  try {
    admin = createAdminClient()
  } catch (error) {
    console.error('Failed to initialize admin client for inbound availability email:', error)
    return NextResponse.json({ error: 'Could not initialize intake processing.' }, { status: 500 })
  }

  try {
    const [emailContent, attachmentRecords] = await Promise.all([
      fetchReceivedEmail(emailId),
      listReceivedEmailAttachments(emailId),
    ])
    const sender = resolveSender(emailContent.from)

    const { data: matchedTherapist } = sender.email
      ? await admin.from('profiles').select('id').ilike('email', sender.email).maybeSingle()
      : { data: null }

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
    const ocrTexts: string[] = []
    for (const [index, attachment] of attachmentRecords.entries()) {
      const attachmentId =
        typeof attachment.id === 'string'
          ? attachment.id.trim()
          : `generated-${emailId}-${index + 1}`
      const filename =
        typeof attachment.filename === 'string'
          ? attachment.filename.trim()
          : typeof attachment.name === 'string'
            ? String(attachment.name).trim()
            : 'attachment'
      const contentType =
        typeof attachment.content_type === 'string'
          ? attachment.content_type
          : typeof attachment.type === 'string'
            ? attachment.type
            : 'application/octet-stream'
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
          typeof attachment.content_disposition === 'string'
            ? attachment.content_disposition
            : null,
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
      }
      const ocrResult = await extractTextFromImageAttachment({
        contentBase64: attachmentRow.content_base64,
        contentType: attachmentRow.content_type,
        filename: attachmentRow.filename,
      })
      attachmentRow.ocr_status = ocrResult.status
      attachmentRow.ocr_text = ocrResult.text
      attachmentRow.ocr_model = ocrResult.model

      if (ocrResult.text) {
        ocrTexts.push(`Attachment ${attachmentRow.filename}\n${ocrResult.text}`)
      }

      processedAttachments.push(attachmentRow)
    }

    const combinedSourceText = mergeSources([
      normalizeEmailText(emailContent),
      ocrTexts.join('\n\n'),
    ])
    const parsed = parseAvailabilityEmail(combinedSourceText, cycles)
    const parseStatus =
      parsed.status === 'parsed' && matchedTherapist?.id && parsed.matchedCycleId
        ? 'parsed'
        : parsed.requests.length > 0 || parsed.unresolvedLines.length > 0
          ? 'needs_review'
          : 'failed'

    const summary = buildParseSummary(parsed.summary, {
      therapistMatched: Boolean(matchedTherapist?.id),
      cycleMatched: Boolean(parsed.matchedCycleId),
    })

    const intakeInsert = {
      provider: 'resend',
      provider_email_id: emailId,
      provider_message_id: emailContent.message_id ?? null,
      from_email: sender.email ?? 'unknown@unknown.invalid',
      from_name: sender.name,
      subject: emailContent.subject ?? null,
      text_content: combinedSourceText || null,
      html_content: emailContent.html ?? emailContent.html_content ?? null,
      received_at: emailContent.created_at ?? new Date().toISOString(),
      matched_therapist_id: matchedTherapist?.id ?? null,
      matched_cycle_id: parsed.matchedCycleId,
      parse_status: parseStatus,
      parse_summary: summary,
      parsed_requests: parsed.requests,
      raw_payload: payload,
    }

    const { data: savedIntake, error: intakeError } = await admin
      .from('availability_email_intakes')
      .upsert(intakeInsert, { onConflict: 'provider_email_id' })
      .select('id')
      .single()

    if (intakeError || !savedIntake) {
      console.error('Failed to store availability email intake:', intakeError)
      return NextResponse.json({ error: 'Could not store intake.' }, { status: 500 })
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
        },
        { onConflict: 'provider_attachment_id' }
      )
    }

    return NextResponse.json({
      ok: true,
      intake_id: savedIntake.id,
      parse_status: parseStatus,
      parsed_count: parsed.requests.length,
    })
  } catch (error) {
    console.error('Failed to process inbound availability email:', error)
    return NextResponse.json({ error: 'Could not process inbound email.' }, { status: 500 })
  }
}
