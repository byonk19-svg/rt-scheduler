import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, CalendarDays, CheckCircle2, CircleX, Clock3, Send, Trash2 } from 'lucide-react'

import { deletePublishEventAction } from '@/app/publish/actions'
import { PublishHistoryHeader } from '@/components/manager/PublishHistoryHeader'
import { PublishHistoryTable } from '@/components/manager/PublishHistoryTable'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'

export const metadata: Metadata = {
  title: 'Delivery History',
}

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
        published: boolean
      }
    | {
        label: string
        published: boolean
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

type PublishHistoryPageProps = {
  searchParams?: Promise<{
    success?: string
    error?: string
  }>
}

export default async function PublishHistoryPage(props: PublishHistoryPageProps) {
  const resolvedSearchParams = (await props.searchParams) ?? {}
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
      'id, cycle_id, published_at, status, recipient_count, channel, queued_count, sent_count, failed_count, error_message, schedule_cycles(label,published), profiles!publish_events_published_by_fkey(full_name)'
    )
    .order('published_at', { ascending: false })
    .limit(50)

  if (eventsError) {
    return (
      <div className="space-y-4">
        <div className="border-b border-border bg-card px-6 pb-4 pt-5">
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
            Delivery history
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
      <PublishHistoryHeader
        failedCount={failedCount}
        queuedCount={queuedCount}
        successCount={successCount}
      />

      {resolvedSearchParams.success === 'publish_event_deleted' && (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--success-border)',
            backgroundColor: 'var(--success-subtle)',
            color: 'var(--success-text)',
          }}
        >
          Publish history entry deleted.
        </div>
      )}

      {(resolvedSearchParams.error === 'missing_publish_event' ||
        resolvedSearchParams.error === 'delete_publish_event_failed' ||
        resolvedSearchParams.error === 'delete_live_publish_event') && (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--error-border)',
            backgroundColor: 'var(--error-subtle)',
            color: 'var(--error-text)',
          }}
        >
          {resolvedSearchParams.error === 'missing_publish_event'
            ? 'Could not delete that history entry because no publish event was selected.'
            : resolvedSearchParams.error === 'delete_live_publish_event'
              ? 'Live publish entries must be restarted from the schedule workspace before they can be removed from history.'
              : 'Could not delete that publish history entry. Please try again.'}
        </div>
      )}

      <PublishHistoryTable deletePublishEventAction={deletePublishEventAction} events={events} />
    </div>
  )
}
