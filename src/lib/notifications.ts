import type { createClient } from '@/lib/supabase/server'

type NotificationTargetType = 'schedule_cycle' | 'shift' | 'shift_post' | 'system'
type NotificationChannel = 'in_app' | 'email'

type NotificationPayload = {
  userId: string
  eventType: string
  title: string
  message: string
  targetType?: NotificationTargetType
  targetId?: string
}

type NotificationPreferenceRow = {
  id: string
  notification_in_app_enabled?: boolean | null
  notification_email_enabled?: boolean | null
}

export async function filterUserIdsByNotificationChannel(
  supabase: ServerSupabaseClient,
  userIds: string[],
  channel: NotificationChannel
): Promise<string[]> {
  const dedupedUserIds = Array.from(new Set(userIds.filter(Boolean)))
  if (dedupedUserIds.length === 0) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, notification_in_app_enabled, notification_email_enabled')
    .in('id', dedupedUserIds)

  if (error) {
    console.error('Failed to load notification preferences:', error.message)
    return dedupedUserIds
  }

  const rows = (data ?? []) as NotificationPreferenceRow[]
  const rowById = new Map(rows.map((row) => [row.id, row]))

  return dedupedUserIds.filter((userId) => {
    const row = rowById.get(userId)
    if (!row) return true
    return channel === 'email'
      ? row.notification_email_enabled !== false
      : row.notification_in_app_enabled !== false
  })
}

export async function createNotifications(
  supabase: ServerSupabaseClient,
  payloads: NotificationPayload[]
): Promise<void> {
  if (payloads.length === 0) return

  const rows = payloads.map((payload) => ({
    user_id: payload.userId,
    event_type: payload.eventType,
    title: payload.title,
    message: payload.message,
    target_type: payload.targetType ?? null,
    target_id: payload.targetId ?? null,
  }))

  const { error } = await supabase.from('notifications').insert(rows)
  if (error) {
    console.error('Failed to create notifications:', error.message)
  }
}

export async function notifyUsers(
  supabase: ServerSupabaseClient,
  params: {
    userIds: string[]
    eventType: string
    title: string
    message: string
    targetType?: NotificationTargetType
    targetId?: string
  }
): Promise<void> {
  const dedupedUserIds = Array.from(new Set(params.userIds.filter(Boolean)))
  if (dedupedUserIds.length === 0) return
  const inAppEnabledUserIds = await filterUserIdsByNotificationChannel(
    supabase,
    dedupedUserIds,
    'in_app'
  )
  if (inAppEnabledUserIds.length === 0) return

  await createNotifications(
    supabase,
    inAppEnabledUserIds.map((userId) => ({
      userId,
      eventType: params.eventType,
      title: params.title,
      message: params.message,
      targetType: params.targetType,
      targetId: params.targetId,
    }))
  )
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>
