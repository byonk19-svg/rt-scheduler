'use client'

import { Bell } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'

type NotificationBellProps = {
  variant?: 'default' | 'staff' | 'shell'
  initialUnreadCount?: number
}

function NotificationBellFallback({
  variant = 'default',
  initialUnreadCount = 0,
}: NotificationBellProps) {
  const unreadBadgeLabel = initialUnreadCount > 9 ? '9+' : String(initialUnreadCount)
  const isStaffVariant = variant === 'staff'
  const isShellVariant = variant === 'shell'

  return (
    <span aria-hidden="true" className="bell-wrapper relative inline-flex" suppressHydrationWarning>
      <span
        className={`relative inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-md border transition-[box-shadow,background-color,border-color] duration-150 ${
          isShellVariant
            ? 'border-sidebar-border/90 bg-sidebar-accent/55 text-sidebar-primary shadow-tw-2xs'
            : `border-border bg-card text-foreground ${isStaffVariant ? '' : 'hover:bg-secondary'}`
        }`}
      >
        <Bell className="h-4 w-4" />
        {initialUnreadCount > 0 &&
          (isStaffVariant ? (
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-card bg-[var(--attention)]" />
          ) : (
            <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadBadgeLabel}
            </span>
          ))}
      </span>
    </span>
  )
}

export function DeferredNotificationBell(props: NotificationBellProps) {
  const [NotificationBell, setNotificationBell] =
    useState<ComponentType<NotificationBellProps> | null>(null)

  useEffect(() => {
    let active = true

    void import('@/components/NotificationBell').then((module) => {
      if (!active) return
      setNotificationBell(() => module.NotificationBell)
    })

    return () => {
      active = false
    }
  }, [])

  if (!NotificationBell) {
    return <NotificationBellFallback {...props} />
  }

  return <NotificationBell {...props} />
}
