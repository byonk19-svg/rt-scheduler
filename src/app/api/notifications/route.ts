import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

type NotificationRow = {
  id: string
  event_type: string
  title: string
  message: string
  target_type: 'schedule_cycle' | 'shift' | 'shift_post' | 'system' | null
  target_id: string | null
  created_at: string
  read_at: string | null
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [notificationsResult, unreadCountResult] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, event_type, title, message, target_type, target_id, created_at, read_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null),
  ])

  if (notificationsResult.error || unreadCountResult.error) {
    return NextResponse.json({ error: 'Could not load notifications' }, { status: 500 })
  }

  const notifications = (notificationsResult.data ?? []) as NotificationRow[]
  const unreadCount = unreadCountResult.count ?? 0

  return NextResponse.json({ notifications, unreadCount })
}
