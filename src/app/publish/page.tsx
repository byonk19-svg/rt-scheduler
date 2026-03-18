import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, CalendarDays, CheckCircle2, CircleX, Clock3, Send } from 'lucide-react'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { createClient } from '@/lib/supabase/server'

type PublishEventRow = {
  id: string
  cycle_id: string
  published_at: string
  status: 'success' | 'failed'
  recipient_count: number
  channel: string
  queued_count: number
  sent_count: number
  failed_count: number
  error_message: string | null
  schedule_cycles:
    | {
        label: string
      }
    | {
        label: string
      }[]
    | null
  profiles:
    | {
        full_name: string | null
      }
    | {
        full_name: string | null
      }[]
    | null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function StatusChip({ status }: { status: 'success' | 'failed' }) {
  if (status === 'success') {
    return (
      <span
        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
        style={{
          borderColor: 'var(--success-border)',
          backgroundColor: 'var(--success-subtle)',
          color: 'var(--success-text)',
        }}
      >
        Success
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        borderColor: 'var(--error-border)',
        backgroundColor: 'var(--error-subtle)',
        color: 'var(--error-text)',
      }}
    >
      Failed
    </span>
  )
}

export default async function PublishHistoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!can(parseRole(profile?.role), 'manage_publish')) {
    redirect('/dashboard')
  }

  const { data: eventsData, error: eventsError } = await supabase
    .from('publish_events')
    .select(
      'id, cycle_id, published_at, status, recipient_count, channel, queued_count, sent_count, failed_count, error_message, schedule_cycles(label), profiles!publish_events_published_by_fkey(full_name)'
    )
    .order('published_at', { ascending: false })
    .limit(50)

  if (eventsError) {
    return (
      <div className="space-y-4">
        <div className="border-b border-border bg-card px-6 pb-4 pt-5">
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
            Publish History
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Schedule email delivery log.</p>
        </div>
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--error-border)',
            backgroundColor: 'var(--error-subtle)',
            color: 'var(--error-text)',
          }}
        >
          Could not load publish history. Please try refreshing.
        </div>
      </div>
    )
  }

  const events = (eventsData ?? []) as PublishEventRow[]
  const successCount = events.filter((event) => event.status === 'success').length
  const failedCount = events.filter((event) => event.status === 'failed').length
  const queuedCount = events.reduce((total, event) => total + Math.max(event.queued_count, 0), 0)

  return (
    <div className="space-y-5">
      <div className="border-b border-border bg-card px-6 pb-4 pt-5">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
              Publish History
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Track schedule email delivery for each publish event.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link href="/coverage">
              <CalendarDays className="h-3.5 w-3.5" />
              Back to schedule
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge variant="success">
            <CheckCircle2 className="h-3 w-3" />
            {successCount} successful
          </StatusBadge>
          <StatusBadge variant="error">
            <CircleX className="h-3 w-3" />
            {failedCount} failed
          </StatusBadge>
          <StatusBadge variant="warning">
            <Clock3 className="h-3 w-3" />
            {queuedCount} queued
          </StatusBadge>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted">
              <Send className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">No publish events yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Publish a schedule from the schedule workspace to see delivery history here.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/coverage?view=week">Go to schedule</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Published at</th>
                  <th className="px-4 py-3">Cycle</th>
                  <th className="px-4 py-3">Published by</th>
                  <th className="px-4 py-3 text-right">Recipients</th>
                  <th className="px-4 py-3 text-right">Queued</th>
                  <th className="px-4 py-3 text-right">Sent</th>
                  <th className="px-4 py-3 text-right">Failed</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((event) => (
                  <tr key={event.id} className="group">
                    <td className="px-4 py-3 text-sm text-foreground">
                      {new Date(event.published_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {getOne(event.schedule_cycles)?.label ?? event.cycle_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {getOne(event.profiles)?.full_name ?? 'Manager'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-foreground">
                      {event.recipient_count}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                      {event.queued_count}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-[var(--success-text)]">
                      {event.sent_count}
                    </td>
                    <td
                      className="px-4 py-3 text-right text-sm tabular-nums"
                      style={{ color: event.failed_count > 0 ? 'var(--error-text)' : undefined }}
                    >
                      <span
                        className={
                          event.failed_count > 0 ? 'font-semibold' : 'text-muted-foreground'
                        }
                      >
                        {event.failed_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={event.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/publish/${event.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        Details
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
