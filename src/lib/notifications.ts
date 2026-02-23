import type { createClient } from '@/lib/supabase/server'

type NotificationTargetType = 'schedule_cycle' | 'shift' | 'shift_post' | 'system'

type NotificationPayload = {
  userId: string
  eventType: string
  title: string
  message: string
  targetType?: NotificationTargetType
  targetId?: string
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

  await createNotifications(
    supabase,
    dedupedUserIds.map((userId) => ({
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
