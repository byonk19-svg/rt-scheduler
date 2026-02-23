'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell } from 'lucide-react'

type NotificationItem = {
  id: string
  title: string
  message: string
  created_at: string
  read_at: string | null
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  async function loadNotifications() {
    const response = await fetch('/api/notifications', { cache: 'no-store' })
    if (!response.ok) return
    const data = (await response.json()) as {
      unreadCount: number
      notifications: NotificationItem[]
    }
    setUnreadCount(data.unreadCount)
    setNotifications(data.notifications)
    setLoading(false)
  }

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void loadNotifications()
    }, 0)
    const timer = window.setInterval(() => {
      void loadNotifications()
    }, 60000)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(timer)
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

  async function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) {
      await markAllAsRead()
    }
  }

  const unreadBadgeLabel = useMemo(
    () => (unreadCount > 9 ? '9+' : String(unreadCount)),
    [unreadCount]
  )

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          void toggleOpen()
        }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white text-foreground hover:bg-secondary"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadBadgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-md border border-border bg-white p-2 shadow-lg">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notifications
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
                  className="rounded-md border border-border bg-card px-2 py-2"
                >
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatTimestamp(item.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
