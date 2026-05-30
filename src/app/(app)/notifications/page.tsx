import type { Metadata } from 'next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { ComponentType } from 'react'
import { Bell, CheckCheck, CheckCircle2, Filter, Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { parseRole } from '@/lib/auth/roles'
import { resolveNotificationHref } from '@/lib/notification-routing'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Schedule, request, and preliminary updates in one place.',
}

type NotificationRow = {
  id: string
  title: string
  message: string
  event_type: string
  target_type: 'schedule_cycle' | 'shift' | 'shift_post' | 'system' | null
  target_id: string | null
  created_at: string
  read_at: string | null
}

type NotificationDisplayRow = NotificationRow & {
  href: string | null
}

type NotificationFilter = 'all' | 'unread' | 'schedule' | 'requests' | 'preliminary'
type NotificationsSearchParams = { filter?: string | string[] }

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function formatTime(iso: string): string {
  const created = new Date(iso)
  if (Number.isNaN(created.getTime())) return iso
  return created.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getEventTypeLabel(eventType: string): string {
  if (eventType.startsWith('preliminary_')) return 'Preliminary'
  if (eventType === 'call_in_help_available') return 'Request'
  if (eventType.includes('publish')) return 'Publish'
  if (eventType.includes('request')) return 'Request'
  if (eventType.includes('schedule')) return 'Schedule'
  return eventType
}

function toDayKey(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return 'unknown'
  return parsed.toISOString().slice(0, 10)
}

function toDayLabel(dayKey: string): string {
  if (dayKey === 'unknown') return 'Unknown date'
  const parsed = new Date(`${dayKey}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return dayKey
  return parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function includesFilter(item: NotificationRow, filter: NotificationFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'unread') return item.read_at === null
  if (filter === 'preliminary') return item.event_type.startsWith('preliminary_')
  if (filter === 'requests')
    return item.event_type.includes('request') || item.event_type === 'call_in_help_available'
  if (filter === 'schedule')
    return (
      item.event_type.includes('schedule') ||
      item.event_type.includes('publish') ||
      item.event_type === 'shift_reminder'
    )
  return true
}

function getEmptyStateDescription(filter: NotificationFilter): string {
  if (filter === 'all') return 'No notifications yet.'
  if (filter === 'unread') return 'No unread notifications right now.'
  if (filter === 'schedule') return 'No schedule notifications right now.'
  if (filter === 'requests') return 'No request notifications right now.'
  if (filter === 'preliminary') return 'No preliminary notifications right now.'
  return 'No notifications yet.'
}

async function markAllReadAction() {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  revalidatePath('/notifications')
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<NotificationsSearchParams>
}) {
  const supabase = await createClient()
  const params = searchParams ? await searchParams : undefined
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: notificationsData } = await supabase
    .from('notifications')
    .select('id, title, message, event_type, target_type, target_id, created_at, read_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const userRole = parseRole((profileData as { role?: string | null } | null)?.role)
  const notifications = (notificationsData ?? []) as NotificationRow[]
  const notificationRows: NotificationDisplayRow[] = notifications.map((item) => ({
    ...item,
    href: resolveNotificationHref(item, userRole),
  }))
  const rawFilter = getSearchParam(params?.filter)
  const filter: NotificationFilter =
    rawFilter === 'unread' ||
    rawFilter === 'schedule' ||
    rawFilter === 'requests' ||
    rawFilter === 'preliminary'
      ? rawFilter
      : 'all'
  const unreadCount = notificationRows.filter((item) => item.read_at === null).length
  const filtered = notificationRows.filter((item) => includesFilter(item, filter))

  const grouped = new Map<string, NotificationDisplayRow[]>()
  for (const item of filtered) {
    const key = toDayKey(item.created_at)
    const existing = grouped.get(key) ?? []
    existing.push(item)
    grouped.set(key, existing)
  }
  const groupedEntries = Array.from(grouped.entries()).map(([date, items]) => ({
    date,
    label: toDayLabel(date),
    items,
  }))

  const filterOptions: Array<{
    id: NotificationFilter
    label: string
    count: number
    icon: ComponentType<{ className?: string }>
  }> = [
    { id: 'all', label: 'All', count: notificationRows.length, icon: Inbox },
    { id: 'unread', label: 'Unread', count: unreadCount, icon: Bell },
    {
      id: 'schedule',
      label: 'Schedule',
      count: notificationRows.filter((item) => includesFilter(item, 'schedule')).length,
      icon: Filter,
    },
    {
      id: 'requests',
      label: 'Requests',
      count: notificationRows.filter((item) => includesFilter(item, 'requests')).length,
      icon: Filter,
    },
    {
      id: 'preliminary',
      label: 'Preliminary',
      count: notificationRows.filter((item) => includesFilter(item, 'preliminary')).length,
      icon: Filter,
    },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-2 pb-6">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-tw-float">
        <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[1.85rem] font-bold tracking-tight text-foreground">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                : 'Schedule, request, and preliminary updates in one place.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 ? (
              <form action={markAllReadAction}>
                <Button type="submit" variant="outline" size="sm" className="gap-1.5">
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 pt-0.5">
        {filterOptions.map((option) => {
          const Icon = option.icon
          const active = filter === option.id
          return (
            <Link
              key={option.id}
              href={`/notifications?filter=${option.id}`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {option.label}
              {option.count > 0 ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    active
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {option.count}
                </span>
              ) : null}
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-[var(--success-text)]" />
              You&apos;re all caught up
            </CardTitle>
            <CardDescription>{getEmptyStateDescription(filter)}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-5">
          {groupedEntries.map((group) => (
            <div key={group.date}>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-tw-sm">
                {group.items.map((item) => {
                  const rowClassName = cn(
                    'grid gap-2 px-4 py-3 transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start',
                    item.href ? 'hover:bg-muted/45' : undefined,
                    item.read_at ? 'bg-card' : 'bg-[var(--info-subtle)]/35'
                  )
                  const rowContent = (
                    <>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          {item.read_at === null ? (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                          ) : null}
                          <h2 className="truncate text-sm font-semibold text-foreground">
                            {item.title}
                          </h2>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-foreground/80">
                          {item.message}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {getEventTypeLabel(item.event_type)}
                        </span>
                        <time className="text-xs text-muted-foreground" dateTime={item.created_at}>
                          {formatTime(item.created_at)}
                        </time>
                      </div>
                    </>
                  )

                  return item.href ? (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={cn(rowClassName, 'text-inherit no-underline')}
                    >
                      {rowContent}
                    </Link>
                  ) : (
                    <article key={item.id} className={rowClassName}>
                      {rowContent}
                    </article>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
