import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildPublishEmailPayload,
  getPublishEmailConfig,
  refreshPublishEventCounts,
} from '@/lib/publish-events'
import { createClient } from '@/lib/supabase/server'

type ProfileRoleRow = { role: string | null }

type OutboxRow = {
  id: string
  publish_event_id: string
  email: string
  name: string | null
  attempt_count: number
}

type PublishEventLookupRow = {
  id: string
  schedule_cycles:
    | { label: string | null }
    | { label: string | null }[]
    | null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function parseBatchSize(value: unknown): number {
  if (typeof value !== 'number') return 25
  if (!Number.isFinite(value)) return 25
  const rounded = Math.floor(value)
  if (rounded < 1) return 1
  if (rounded > 100) return 100
  return rounded
}

export async function POST(request: Request) {
  const workerKeyHeader = request.headers.get('x-publish-worker-key')
  const expectedWorkerKey = process.env.PUBLISH_WORKER_KEY
  const allowWorkerKey = Boolean(expectedWorkerKey && workerKeyHeader === expectedWorkerKey)

  if (!allowWorkerKey) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: 'Could not verify manager role.' }, { status: 500 })
    }

    if ((profile as ProfileRoleRow | null)?.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = (await request.json().catch(() => ({}))) as {
    publish_event_id?: unknown
    batch_size?: unknown
  }

  const publishEventId =
    typeof body.publish_event_id === 'string' && body.publish_event_id.trim().length > 0
      ? body.publish_event_id.trim()
      : null
  const batchSize = parseBatchSize(body.batch_size)

  let admin: SupabaseClient
  try {
    admin = createAdminClient()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Missing admin Supabase configuration.'
    return NextResponse.json({ error: message }, { status: 500 })
  }

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
    return NextResponse.json({ error: queuedError.message }, { status: 500 })
  }

  const rows = (queuedRows ?? []) as OutboxRow[]
  const eventIds = Array.from(new Set(rows.map((row) => row.publish_event_id)))

  if (rows.length === 0) {
    const counts = publishEventId ? await refreshPublishEventCounts(admin, [publishEventId]).catch(() => new Map()) : new Map()
    const publishEventCounts = publishEventId
      ? counts.get(publishEventId) ?? { queuedCount: 0, sentCount: 0, failedCount: 0 }
      : null

    return NextResponse.json({
      ok: true,
      processed: 0,
      sent: 0,
      failed: 0,
      emailConfigured: getPublishEmailConfig().configured,
      publishEventCounts,
    })
  }

  const emailConfig = getPublishEmailConfig()

  if (!emailConfig.configured) {
    await admin
      .from('publish_events')
      .update({
        error_message: 'Email not configured; schedule is still published in-app.',
      })
      .in('id', eventIds)

    return NextResponse.json({
      ok: true,
      processed: 0,
      sent: 0,
      failed: 0,
      emailConfigured: false,
      message: 'Email provider is not configured.',
    })
  }

  const { data: publishEventRows, error: publishEventError } = await admin
    .from('publish_events')
    .select('id, schedule_cycles(label)')
    .in('id', eventIds)

  if (publishEventError) {
    return NextResponse.json({ error: publishEventError.message }, { status: 500 })
  }

  const cycleLabelByEventId = new Map(
    ((publishEventRows ?? []) as PublishEventLookupRow[]).map((row) => [
      row.id,
      getOne(row.schedule_cycles)?.label ?? 'Current cycle',
    ])
  )

  let sent = 0
  let failed = 0

  for (const row of rows) {
    const cycleLabel = cycleLabelByEventId.get(row.publish_event_id) ?? 'Current cycle'
    const scheduleUrl = `${emailConfig.appBaseUrl.replace(/\/$/, '')}/staff/schedule`
    const emailPayload = buildPublishEmailPayload({
      recipientName: row.name,
      cycleLabel,
      scheduleUrl,
    })

    try {
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

      if (!resendResponse.ok) {
        const resendError = await resendResponse.text()
        throw new Error(`Resend request failed (${resendResponse.status}): ${resendError}`)
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
      const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown email delivery error'

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
  const publishEventCounts = publishEventId
    ? counts.get(publishEventId) ?? { queuedCount: 0, sentCount: 0, failedCount: 0 }
    : null

  return NextResponse.json({
    ok: true,
    processed: rows.length,
    sent,
    failed,
    emailConfigured: true,
    publishEventCounts,
  })
}


