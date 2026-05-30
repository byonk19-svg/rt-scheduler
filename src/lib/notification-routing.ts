export type NotificationRouteRole = 'manager' | 'therapist' | 'lead' | null

export type NotificationRouteItem = {
  id?: string
  event_type: string
  title?: string | null
  message?: string | null
  target_type: 'schedule_cycle' | 'shift' | 'shift_post' | 'system' | null
  target_id?: string | null
  created_at?: string | null
  read_at?: string | null
}

export function resolveNotificationHref(
  item: NotificationRouteItem,
  userRole: NotificationRouteRole,
  fallbackHref: string | null = null
): string | null {
  const isManager = userRole === 'manager'

  if (item.event_type === 'preliminary_request_submitted') return '/approvals'
  if (item.event_type.startsWith('preliminary_')) {
    return item.target_type === 'shift' && item.target_id
      ? `/preliminary?shift=${item.target_id}`
      : '/preliminary'
  }
  if (item.event_type === 'call_in_help_available') {
    return isManager ? '/requests' : '/therapist/swaps'
  }
  if (item.target_type === 'shift_post') return isManager ? '/requests' : '/therapist/swaps'
  if (item.target_type === 'shift') return '/schedule'
  if (item.target_type === 'schedule_cycle') return '/schedule'
  if (item.event_type.includes('request')) return isManager ? '/requests' : '/therapist/swaps'
  return fallbackHref
}
