'use client'

import { Bell } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'

type NotificationItem = {
  id: string
  event_type: string
  title: string
  message: string
  target_type: 'schedule_cycle' | 'shift' | 'shift_post' | 'system' | null
  target_id: string | null
  created_at: string
  read_at: string | null
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diffMs)) return iso
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${Math.max(mins, 0)}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

export function NotificationBellDropdown({
  dropdownPositionClass,
  loading,
  notifications,
  onItemClick,
  onMarkAllAsRead,
  unreadCount,
}: {
  dropdownPositionClass: string
  loading: boolean
  notifications: NotificationItem[]
  onItemClick: (item: NotificationItem) => void
  onMarkAllAsRead: () => void
  unreadCount: number
}) {
  return (
    <div
      className={`absolute z-40 mt-2 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-border bg-card shadow-lg ${dropdownPositionClass}`}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Notifications
        </p>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={onMarkAllAsRead}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      <div className="max-h-80 divide-y divide-border overflow-auto">
        {loading ? (
          <div className="space-y-0 divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3 px-4 py-3">
                <Skeleton className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2.5 w-full" />
                  <Skeleton className="h-2 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground">No notifications yet.</p>
          </div>
        ) : (
          notifications.map((item) => {
            const isUnread = !item.read_at
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onItemClick(item)}
                aria-label={`${item.title}${isUnread ? ' (unread)' : ''}`}
                className={`flex w-full gap-3 px-4 py-3 text-left transition-colors ${
                  isUnread ? 'bg-muted/60' : 'bg-card'
                } cursor-pointer hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50`}
              >
                <div className="mt-1.5 flex w-2 shrink-0 items-start justify-center">
                  {isUnread ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm leading-snug text-foreground ${
                      isUnread ? 'font-semibold' : 'font-medium'
                    } break-words`}
                  >
                    {item.title}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">{item.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {timeAgo(item.created_at)}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
