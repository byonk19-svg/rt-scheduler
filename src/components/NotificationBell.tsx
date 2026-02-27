'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'

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
  variant?: 'default' | 'staff'
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
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })))
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
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white text-foreground ${
          isStaffVariant ? '' : 'hover:bg-secondary'
        }`}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          isStaffVariant ? (
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border border-white bg-[#d97706]" />
          ) : (
            <span className="absolute -top-1 -right-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadBadgeLabel}
            </span>
          )
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-md border border-border bg-white p-2 shadow-lg">
          <div className="mb-2 flex items-center justify-between px-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notifications</div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  void markAllAsRead()
                }}
                className="text-xs font-semibold text-[#d97706]"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 space-y-1 overflow-auto">
            {loading ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    void handleNotificationClick(item)
                  }}
                  className={`rounded-md border border-border px-2 py-2 ${
                    item.read_at ? 'bg-card' : 'bg-[#fffbeb]'
                  } ${getNotificationHref(item) ? 'cursor-pointer' : ''}`}
                >
                  <p className={`text-sm text-foreground ${item.read_at ? 'font-medium' : 'font-semibold'}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(item.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
