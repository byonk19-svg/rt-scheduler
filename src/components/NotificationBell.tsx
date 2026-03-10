'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
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

type NotificationBellProps = {
  variant?: 'default' | 'staff' | 'shell'
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

function getNotificationHref(item: NotificationItem): string | null {
  if (item.target_type === 'shift_post') return '/requests'
  if (item.target_type === 'shift') return '/coverage'
  if (item.target_type === 'schedule_cycle') return '/schedule'
  if (item.event_type.includes('request')) return '/requests'
  return null
}

export function NotificationBell({ variant = 'default' }: NotificationBellProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const loadNotifications = useCallback(async () => {
    const response = await fetch('/api/notifications', { cache: 'no-store' })
    if (!response.ok) return
    const data = (await response.json()) as {
      unreadCount: number
      notifications: NotificationItem[]
    }
    setUnreadCount(data.unreadCount)
    setNotifications(data.notifications)
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    async function loadUserAndNotifications() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active) return
      setCurrentUserId(user?.id ?? null)
      void loadNotifications()
    }

    void loadUserAndNotifications()

    return () => {
      active = false
    }
  }, [loadNotifications, supabase])

  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`notifications_${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          void loadNotifications()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [currentUserId, loadNotifications, supabase])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!(event.target instanceof Node)) return
      if (wrapperRef.current?.contains(event.target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  async function markAllAsRead() {
    if (unreadCount === 0) return
    const response = await fetch('/api/notifications/mark-read', { method: 'POST' })
    if (!response.ok) return
    setUnreadCount(0)
    const now = new Date().toISOString()
    setNotifications((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? now }))
    )
  }

  async function handleNotificationClick(item: NotificationItem) {
    const href = getNotificationHref(item)
    setOpen(false)
    if (href) {
      router.push(href)
    }
  }

  const unreadBadgeLabel = useMemo(
    () => (unreadCount > 9 ? '9+' : String(unreadCount)),
    [unreadCount]
  )

  const isStaffVariant = variant === 'staff'
  const isShellVariant = variant === 'shell'

  return (
    <div ref={wrapperRef} className="bell-wrapper relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current)
          if (!open) {
            void loadNotifications()
          }
        }}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-md border ${
          isShellVariant
            ? 'border-sidebar-border bg-sidebar-accent/35 text-sidebar-foreground hover:bg-sidebar-accent'
            : `border-border bg-card text-foreground ${isStaffVariant ? '' : 'hover:bg-secondary'}`
        }`}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 &&
          (isStaffVariant ? (
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-card bg-[var(--attention)]" />
          ) : (
            <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadBadgeLabel}
            </span>
          ))}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Notifications
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  void markAllAsRead()
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
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
                const href = getNotificationHref(item)
                const isUnread = !item.read_at
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      void handleNotificationClick(item)
                    }}
                    className={`flex gap-3 px-4 py-3 transition-colors ${
                      isUnread ? 'bg-muted/60' : 'bg-card'
                    } ${href ? 'cursor-pointer hover:bg-muted/80' : ''}`}
                  >
                    {/* Unread indicator */}
                    <div className="mt-1.5 flex w-2 shrink-0 items-start justify-center">
                      {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm leading-snug text-foreground ${
                          isUnread ? 'font-semibold' : 'font-medium'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {timeAgo(item.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
