import type { SupabaseClient } from '@supabase/supabase-js'

import { getPublishEmailConfig } from '@/lib/publish-events'

type ShiftReminderShiftRow = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  user_id: string | null
  profiles:
    | {
        email: string | null
        full_name: string | null
      }
    | {
        email: string | null
        full_name: string | null
      }[]
    | null
}

type ShiftReminderOutboxRow = {
  id: string
  shift_id: string
  user_id: string | null
  email: string
  name: string | null
  attempt_count: number
  remind_type: '24h'
  shifts:
    | {
        date: string
        shift_type: 'day' | 'night'
      }
    | {
        date: string
        shift_type: 'day' | 'night'
      }[]
    | null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function getTomorrowIsoDate(now: Date): string {
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return tomorrow.toISOString().slice(0, 10)
}

function buildShiftReminderEmailPayload(params: {
  recipientName: string | null
  shiftType: 'day' | 'night'
  date: string
  scheduleUrl: string
}) {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : 'Hi there,'
  const shiftLabel = params.shiftType === 'day' ? 'day' : 'night'
  const subject = `Shift reminder: ${shiftLabel} shift tomorrow`
  const text = `${greeting}\n\nYou have a ${shiftLabel} shift tomorrow (${params.date}).\n\nView schedule: ${params.scheduleUrl}\n\n- Teamwise`
  const html = `<p>${greeting}</p><p>You have a <strong>${shiftLabel}</strong> shift tomorrow (${params.date}).</p><p><a href="${params.scheduleUrl}">View your schedule</a></p><p>- Teamwise</p>`

  return { subject, text, html }
}

export async function queueAndSendShiftReminders(
  adminClient: SupabaseClient,
  now: Date
): Promise<{ queued: number; sent: number; failed: number }> {
  const tomorrow = getTomorrowIsoDate(now)
  const nowIso = now.toISOString()

  const { data: shiftRows, error: shiftError } = await adminClient
    .from('shifts')
    .select('id, date, shift_type, user_id, profiles!shifts_user_id_fkey(email, full_name)')
    .eq('date', tomorrow)
    .eq('status', 'scheduled')

  if (shiftError) {
    throw new Error(shiftError.message)
  }

  const reminderCandidates = ((shiftRows ?? []) as ShiftReminderShiftRow[])
    .map((row) => ({
      shift_id: row.id,
      user_id: row.user_id,
      email: getOne(row.profiles)?.email ?? null,
      name: getOne(row.profiles)?.full_name ?? null,
      remind_type: '24h' as const,
      send_after: nowIso,
      status: 'queued' as const,
    }))
    .filter(
      (
        row
      ): row is {
        shift_id: string
        user_id: string
        email: string
        name: string | null
        remind_type: '24h'
        send_after: string
        status: 'queued'
      } => Boolean(row.user_id && row.email)
    )

  let queued = 0
  if (reminderCandidates.length > 0) {
    const { data: insertedRows, error: insertError } = await adminClient
      .from('shift_reminder_outbox')
      .upsert(reminderCandidates, {
        onConflict: 'shift_id,remind_type',
        ignoreDuplicates: true,
      })
      .select('id')

    if (insertError) {
      throw new Error(insertError.message)
    }

    queued = insertedRows?.length ?? 0
  }

  const { data: queuedRows, error: queuedError } = await adminClient
    .from('shift_reminder_outbox')
    .select(
      'id, shift_id, user_id, email, name, attempt_count, remind_type, shifts!shift_reminder_outbox_shift_id_fkey(date, shift_type)'
    )
    .lte('send_after', nowIso)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })

  if (queuedError) {
    throw new Error(queuedError.message)
  }

  const rows = (queuedRows ?? []) as ShiftReminderOutboxRow[]
  if (rows.length === 0) {
    return { queued, sent: 0, failed: 0 }
  }

  const emailConfig = getPublishEmailConfig()
  const scheduleUrl = `${emailConfig.appBaseUrl.replace(/\/$/, '')}/staff/my-schedule`

  let sent = 0
  let failed = 0

  for (const row of rows) {
    const shift = getOne(row.shifts)
    const shiftType = shift?.shift_type ?? 'day'
    const shiftDate = shift?.date ?? tomorrow

    if (!emailConfig.configured) {
      const { error: failUpdateError } = await adminClient
        .from('shift_reminder_outbox')
        .update({
          status: 'failed',
          attempt_count: row.attempt_count + 1,
          last_error: 'Email provider is not configured.',
          sent_at: null,
        })
        .eq('id', row.id)

      if (failUpdateError) {
        throw new Error(failUpdateError.message)
      }

      failed += 1
      continue
    }

    const emailPayload = buildShiftReminderEmailPayload({
      recipientName: row.name,
      shiftType,
      date: shiftDate,
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

      const { error: sentUpdateError } = await adminClient
        .from('shift_reminder_outbox')
        .update({
          status: 'sent',
          attempt_count: row.attempt_count + 1,
          last_error: null,
          sent_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      if (sentUpdateError) {
        throw new Error(sentUpdateError.message)
      }

      const { error: notificationError } = await adminClient.from('notifications').insert({
        user_id: row.user_id,
        event_type: 'shift_reminder',
        title: 'Shift reminder',
        message: `You have a ${shiftType} shift tomorrow (${shiftDate}).`,
        target_type: 'shift',
        target_id: row.shift_id,
      })

      if (notificationError) {
        throw new Error(notificationError.message)
      }

      sent += 1
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown shift reminder delivery error'

      const { error: failUpdateError } = await adminClient
        .from('shift_reminder_outbox')
        .update({
          status: 'failed',
          attempt_count: row.attempt_count + 1,
          last_error: errorMessage,
          sent_at: null,
        })
        .eq('id', row.id)

      if (failUpdateError) {
        throw new Error(failUpdateError.message)
      }

      failed += 1
    }
  }

  return { queued, sent, failed }
}
