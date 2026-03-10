import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Bell, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

type NotificationRow = {
  id: string
  title: string
  message: string
  event_type: string
  created_at: string
  read_at: string | null
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

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: notificationsData } = await supabase
    .from('notifications')
    .select('id, title, message, event_type, created_at, read_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const notifications = (notificationsData ?? []) as NotificationRow[]
  const unreadCount = notifications.filter((item) => item.read_at === null).length

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_2px_18px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Activity Center
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Stay on top of schedule updates, approvals, and staffing changes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Bell className="h-3.5 w-3.5" />
              {unreadCount} unread
            </span>
            <form action={markAllReadAction}>
              <Button type="submit" variant="outline" size="sm">
                Mark all read
              </Button>
            </form>
          </div>
        </div>
      </section>

      {notifications.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-[var(--success-text)]" />
              You&apos;re all caught up
            </CardTitle>
            <CardDescription>No notifications yet.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <Card
              key={item.id}
              className={
                item.read_at ? '' : 'border-[var(--info-border)] bg-[var(--info-subtle)]/30'
              }
            >
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(item.created_at)}
                  </span>
                </div>
                <CardDescription className="uppercase tracking-wide">
                  {item.event_type}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/85">{item.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
