'use server'

import { can } from '@/lib/auth/can'
import {
  sendAvailabilityReminderEmails,
  type ReminderRecipient,
} from '@/lib/availability-reminders'
import { formatHumanCycleRange } from '@/lib/calendar-utils'
import { getPublishEmailConfig } from '@/lib/publish-events'
import { getAuthenticatedUserWithRole } from './_actions/shared'

const AVAILABILITY_REMINDER_AUDIT_ACTION = 'availability_reminders_sent'
const RECENT_REMINDER_WINDOW_HOURS = 24

export async function sendAvailabilityRemindersAction(cycleId: string): Promise<{
  sent: number
  skipped: number
  failed: number
  error?: string
  lastSentAt?: string
}> {
  const { supabase, user, role, siteId, permissionContext } = await getAuthenticatedUserWithRole()

  if (!siteId || !can(role, 'access_manager_ui', permissionContext)) {
    return { sent: 0, skipped: 0, failed: 0, error: 'unauthorized' }
  }

  const emailConfig = getPublishEmailConfig()
  if (!emailConfig.configured || !emailConfig.resendApiKey || !emailConfig.fromEmail) {
    return { sent: 0, skipped: 0, failed: 0, error: 'email_not_configured' }
  }

  const { data: cycle } = await supabase
    .from('schedule_cycles')
    .select('start_date, end_date, site_id')
    .eq('id', cycleId)
    .maybeSingle()

  if (!cycle?.site_id || cycle.site_id !== siteId) {
    return { sent: 0, skipped: 0, failed: 0, error: 'cycle_not_found' }
  }

  const cycleDateRange = formatHumanCycleRange(cycle.start_date, cycle.end_date)

  const recentReminderCutoff = new Date(
    Date.now() - RECENT_REMINDER_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString()
  const { data: recentReminderRows, error: recentReminderError } = await supabase
    .from('audit_log')
    .select('created_at')
    .eq('action', AVAILABILITY_REMINDER_AUDIT_ACTION)
    .eq('target_type', 'schedule_cycle')
    .eq('target_id', cycleId)
    .gte('created_at', recentReminderCutoff)
    .order('created_at', { ascending: false })
    .limit(1)

  if (recentReminderError) {
    console.error('[sendAvailabilityRemindersAction] reminder audit lookup failed:', {
      message: recentReminderError.message,
    })
    return { sent: 0, skipped: 0, failed: 0, error: 'db_error' }
  }

  const lastSentAt = recentReminderRows?.[0]?.created_at
  if (lastSentAt) {
    return { sent: 0, skipped: 0, failed: 0, error: 'recently_sent', lastSentAt }
  }

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, notification_email_enabled, on_fmla')
    .in('role', ['therapist', 'lead'])
    .eq('is_active', true)
    .is('archived_at', null)
    .eq('on_fmla', false)
    .eq('site_id', cycle.site_id)

  if (profileError) {
    console.error('[sendAvailabilityRemindersAction] profile fetch failed:', profileError)
    return { sent: 0, skipped: 0, failed: 0, error: 'db_error' }
  }

  const { data: submissionRows, error: submissionError } = await supabase
    .from('therapist_availability_submissions')
    .select('therapist_id')
    .eq('schedule_cycle_id', cycleId)

  if (submissionError) {
    console.error('[sendAvailabilityRemindersAction] submission fetch failed:', submissionError)
    return { sent: 0, skipped: 0, failed: 0, error: 'db_error' }
  }

  const submittedIds = new Set((submissionRows ?? []).map((row) => row.therapist_id))

  const recipients: ReminderRecipient[] = []
  let skipped = 0

  for (const profile of profileRows ?? []) {
    if (submittedIds.has(profile.id)) continue

    if (!profile.email || profile.notification_email_enabled === false) {
      skipped++
      continue
    }

    recipients.push({
      therapistId: profile.id,
      email: profile.email,
      name: profile.full_name ?? null,
    })
  }

  if (recipients.length === 0) {
    return { sent: 0, skipped, failed: 0 }
  }

  const availabilityUrl = `${emailConfig.appBaseUrl.replace(/\/$/, '')}/availability`

  const { sent, failed } = await sendAvailabilityReminderEmails({
    recipients,
    cycleDateRange,
    availabilityUrl,
    emailConfig: {
      resendApiKey: emailConfig.resendApiKey,
      fromEmail: emailConfig.fromEmail,
      resendApiUrl: emailConfig.resendApiUrl,
    },
  })

  if (sent > 0 || failed > 0) {
    const { error: auditError } = await supabase.from('audit_log').insert({
      user_id: user.id,
      action: AVAILABILITY_REMINDER_AUDIT_ACTION,
      target_type: 'schedule_cycle',
      target_id: cycleId,
    })

    if (auditError) {
      console.error('[sendAvailabilityRemindersAction] reminder audit write failed:', {
        message: auditError.message,
      })
      if (sent > 0) {
        return { sent, skipped, failed, error: 'duplicate_marker_failed' }
      }
    }
  }

  return { sent, skipped, failed }
}
