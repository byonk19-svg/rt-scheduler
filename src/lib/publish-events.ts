import type { SupabaseClient } from '@supabase/supabase-js'

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

const RESEND_API_URL = 'https://api.resend.com/emails'

function dedupeEventIds(eventIds: string[]): string[] {
  return Array.from(new Set(eventIds.filter(Boolean)))
}

export function getPublishEmailConfig() {
  const resendApiKey = process.env.RESEND_API_KEY ?? null
  const fromEmail = process.env.PUBLISH_EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? null
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000'

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

  const counts = aggregatePublishDeliveryCounts(
    (rows ?? []) as NotificationOutboxCountRow[],
    ids
  )

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

