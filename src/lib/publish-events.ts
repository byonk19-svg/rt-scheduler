import type { SupabaseClient } from '@supabase/supabase-js'

import { getOne } from '@/lib/schedule-helpers'

export type PublishDeliveryStatus = 'queued' | 'sent' | 'failed'

export type PublishDeliveryCount = {
  queuedCount: number
  sentCount: number
  failedCount: number
}

export type NotificationOutboxCountRow = {
  publish_event_id: string
  status: PublishDeliveryStatus
}

type OutboxRow = {
  id: string
  publish_event_id: string
  email: string
  name: string | null
  attempt_count: number
}

type PublishEventLookupRow = {
  id: string
  schedule_cycles: { label: string | null } | { label: string | null }[] | null
}

export type ProcessQueuedPublishEmailsResult = {
  ok: true
  processed: number
  sent: number
  failed: number
  emailConfigured: boolean
  publishEventCounts: PublishDeliveryCount | null
  message?: string
}

const RESEND_API_URL = 'https://api.resend.com/emails'
const RESEND_MIN_INTERVAL_MS = 600
const RESEND_MAX_ATTEMPTS = 3

function dedupeEventIds(eventIds: string[]): string[] {
  return Array.from(new Set(eventIds.filter(Boolean)))
}

export function getPublishEmailConfig() {
  const resendApiKey = process.env.RESEND_API_KEY ?? null
  const fromEmail = process.env.PUBLISH_EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? null
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  return {
    resendApiKey,
    fromEmail,
    appBaseUrl,
    configured: Boolean(resendApiKey && fromEmail),
    resendApiUrl: RESEND_API_URL,
  }
}

export function aggregatePublishDeliveryCounts(
  rows: NotificationOutboxCountRow[],
  eventIds: string[]
): Map<string, PublishDeliveryCount> {
  const counts = new Map<string, PublishDeliveryCount>()

  for (const eventId of dedupeEventIds(eventIds)) {
    counts.set(eventId, { queuedCount: 0, sentCount: 0, failedCount: 0 })
  }

  for (const row of rows) {
    const bucket = counts.get(row.publish_event_id) ?? {
      queuedCount: 0,
      sentCount: 0,
      failedCount: 0,
    }

    if (row.status === 'queued') bucket.queuedCount += 1
    if (row.status === 'sent') bucket.sentCount += 1
    if (row.status === 'failed') bucket.failedCount += 1

    counts.set(row.publish_event_id, bucket)
  }

  return counts
}

function publishEventStatusFromCounts(count: PublishDeliveryCount): 'success' | 'failed' {
  if (count.failedCount > 0 && count.sentCount === 0 && count.queuedCount === 0) {
    return 'failed'
  }
  return 'success'
}

function publishEventErrorMessageFromCounts(count: PublishDeliveryCount): string | null {
  if (count.failedCount <= 0) return null
  return `${count.failedCount} email notification${count.failedCount === 1 ? '' : 's'} failed.`
}

function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseRetryAfterMs(response: Response): number | null {
  const retryAfter = response.headers.get('retry-after')
  if (!retryAfter) return null

  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.ceil(seconds * 1000)
  }

  const dateMs = Date.parse(retryAfter)
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now()
    return delta > 0 ? delta : null
  }

  return null
}

function normalizeBatchSize(value: number | undefined): number {
  if (!Number.isFinite(value)) return 25
  const rounded = Math.floor(value ?? 25)
  if (rounded < 1) return 1
  if (rounded > 100) return 100
  return rounded
}

export async function refreshPublishEventCounts(
  admin: SupabaseClient,
  eventIds: string[]
): Promise<Map<string, PublishDeliveryCount>> {
  const ids = dedupeEventIds(eventIds)
  if (ids.length === 0) return new Map()

  const { data: rows, error: rowsError } = await admin
    .from('notification_outbox')
    .select('publish_event_id, status')
    .in('publish_event_id', ids)

  if (rowsError) {
    throw new Error(rowsError.message)
  }

  const counts = aggregatePublishDeliveryCounts((rows ?? []) as NotificationOutboxCountRow[], ids)

  for (const eventId of ids) {
    const count = counts.get(eventId) ?? {
      queuedCount: 0,
      sentCount: 0,
      failedCount: 0,
    }

    const { error: updateError } = await admin
      .from('publish_events')
      .update({
        status: publishEventStatusFromCounts(count),
        queued_count: count.queuedCount,
        sent_count: count.sentCount,
        failed_count: count.failedCount,
        error_message: publishEventErrorMessageFromCounts(count),
      })
      .eq('id', eventId)

    if (updateError) {
      throw new Error(updateError.message)
    }
  }

  return counts
}

export function buildPublishEmailPayload(params: {
  recipientName: string | null
  cycleLabel: string
  scheduleUrl: string
}) {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : 'Hi there,'
  const subject = `New schedule published: ${params.cycleLabel}`
  const text = `${greeting}\n\nA new schedule has been published for ${params.cycleLabel}.\n\nView schedule: ${params.scheduleUrl}\n\n- Teamwise`
  const html = `<p>${greeting}</p><p>A new schedule has been published for <strong>${params.cycleLabel}</strong>.</p><p><a href=\"${params.scheduleUrl}\">View your schedule</a></p><p>- Teamwise</p>`

  return { subject, text, html }
}

export async function processQueuedPublishEmails(
  admin: SupabaseClient,
  params?: {
    publishEventId?: string | null
    batchSize?: number
  }
): Promise<ProcessQueuedPublishEmailsResult> {
  const publishEventId = params?.publishEventId?.trim() || null
  const batchSize = normalizeBatchSize(params?.batchSize)

  let outboxQuery = admin
    .from('notification_outbox')
    .select('id, publish_event_id, email, name, attempt_count')
    .eq('channel', 'email')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (publishEventId) {
    outboxQuery = outboxQuery.eq('publish_event_id', publishEventId)
  }

  const { data: queuedRows, error: queuedError } = await outboxQuery

  if (queuedError) {
    throw new Error(queuedError.message)
  }

  const rows = (queuedRows ?? []) as OutboxRow[]
  const eventIds = Array.from(new Set(rows.map((row) => row.publish_event_id)))

  if (rows.length === 0) {
    const counts = publishEventId
      ? await refreshPublishEventCounts(admin, [publishEventId]).catch(() => new Map())
      : new Map()

    return {
      ok: true,
      processed: 0,
      sent: 0,
      failed: 0,
      emailConfigured: getPublishEmailConfig().configured,
      publishEventCounts: publishEventId
        ? (counts.get(publishEventId) ?? { queuedCount: 0, sentCount: 0, failedCount: 0 })
        : null,
    }
  }

  const emailConfig = getPublishEmailConfig()

  if (!emailConfig.configured) {
    await admin
      .from('publish_events')
      .update({
        error_message: 'Email not configured; schedule is still published in-app.',
      })
      .in('id', eventIds)

    return {
      ok: true,
      processed: 0,
      sent: 0,
      failed: 0,
      emailConfigured: false,
      publishEventCounts: null,
      message: 'Email provider is not configured.',
    }
  }

  const { data: publishEventRows, error: publishEventError } = await admin
    .from('publish_events')
    .select('id, schedule_cycles(label)')
    .in('id', eventIds)

  if (publishEventError) {
    throw new Error(publishEventError.message)
  }

  const cycleLabelByEventId = new Map(
    ((publishEventRows ?? []) as PublishEventLookupRow[]).map((row) => [
      row.id,
      getOne(row.schedule_cycles)?.label ?? 'Current cycle',
    ])
  )

  let sent = 0
  let failed = 0
  let nextSendNotBefore = 0

  for (const row of rows) {
    const cycleLabel = cycleLabelByEventId.get(row.publish_event_id) ?? 'Current cycle'
    const scheduleUrl = `${emailConfig.appBaseUrl.replace(/\/$/, '')}/staff/schedule`
    const emailPayload = buildPublishEmailPayload({
      recipientName: row.name,
      cycleLabel,
      scheduleUrl,
    })

    try {
      let delivered = false
      let lastErrorMessage = 'Unknown email delivery error'

      for (let attempt = 1; attempt <= RESEND_MAX_ATTEMPTS; attempt += 1) {
        const now = Date.now()
        if (now < nextSendNotBefore) {
          await wait(nextSendNotBefore - now)
        }

        const resendResponse = await fetch(emailConfig.resendApiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${emailConfig.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: emailConfig.fromEmail,
            to: [row.email],
            subject: emailPayload.subject,
            text: emailPayload.text,
            html: emailPayload.html,
          }),
        })
        nextSendNotBefore = Date.now() + RESEND_MIN_INTERVAL_MS

        if (resendResponse.ok) {
          delivered = true
          break
        }

        const resendError = await resendResponse.text()
        lastErrorMessage = `Resend request failed (${resendResponse.status}): ${resendError}`
        const shouldRetryRateLimit = resendResponse.status === 429 && attempt < RESEND_MAX_ATTEMPTS
        if (!shouldRetryRateLimit) {
          break
        }

        const retryAfterMs = parseRetryAfterMs(resendResponse) ?? 1000
        await wait(Math.max(retryAfterMs, RESEND_MIN_INTERVAL_MS))
      }

      if (!delivered) {
        throw new Error(lastErrorMessage)
      }

      const { error: outboxUpdateError } = await admin
        .from('notification_outbox')
        .update({
          status: 'sent',
          attempt_count: row.attempt_count + 1,
          last_error: null,
          sent_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      if (outboxUpdateError) {
        throw new Error(outboxUpdateError.message)
      }

      sent += 1
    } catch (sendError) {
      const errorMessage =
        sendError instanceof Error ? sendError.message : 'Unknown email delivery error'

      await admin
        .from('notification_outbox')
        .update({
          status: 'failed',
          attempt_count: row.attempt_count + 1,
          last_error: errorMessage,
          sent_at: null,
        })
        .eq('id', row.id)

      failed += 1
    }
  }

  const counts = await refreshPublishEventCounts(admin, eventIds)

  return {
    ok: true,
    processed: rows.length,
    sent,
    failed,
    emailConfigured: true,
    publishEventCounts: publishEventId
      ? (counts.get(publishEventId) ?? { queuedCount: 0, sentCount: 0, failedCount: 0 })
      : null,
  }
}
