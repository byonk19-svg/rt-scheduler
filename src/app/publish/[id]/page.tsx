import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleX,
  Clock3,
  Mail,
} from 'lucide-react'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { FeedbackToast } from '@/components/feedback-toast'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { buildScheduleUrl, parseCount } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/server'
import { ProcessQueuedButton } from '@/app/publish/process-queued-button'
import { requeueFailedPublishEmailsAction } from '@/app/publish/actions'

type PublishEventDetailRow = {
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
        start_date: string
        end_date: string
      }
    | {
        label: string
        start_date: string
        end_date: string
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

type FailedRecipientRow = {
  id: string
  email: string
  name: string | null
  attempt_count: number
  last_error: string | null
  created_at: string
}

type DetailSearchParams = {
  success?: string | string[]
  error?: string | string[]
  requeued?: string | string[]
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-right font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  )
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

export default async function PublishEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<DetailSearchParams>
}) {
  const { id } = await params
  const query = searchParams ? await searchParams : undefined
  const successParam = getSearchParam(query?.success)
  const errorParam = getSearchParam(query?.error)
  const requeuedCount = parseCount(getSearchParam(query?.requeued))

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

  const { data: eventData, error: eventError } = await supabase
    .from('publish_events')
    .select(
      'id, cycle_id, published_at, status, recipient_count, channel, queued_count, sent_count, failed_count, error_message, schedule_cycles(label, start_date, end_date), profiles!publish_events_published_by_fkey(full_name)'
    )
    .eq('id', id)
    .maybeSingle()

  if (eventError || !eventData) {
    return (
      <div className="space-y-4">
        <PageHeader title="Publish Details" subtitle="Schedule email delivery details." />
        <div
          className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--error-border)',
            backgroundColor: 'var(--error-subtle)',
            color: 'var(--error-text)',
          }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          Could not load publish event. It may have been deleted or the ID is invalid.
        </div>
      </div>
    )
  }

  const event = eventData as PublishEventDetailRow
  const { data: failedRowsData, error: failedRowsError } = await supabase
    .from('notification_outbox')
    .select('id, email, name, attempt_count, last_error, created_at')
    .eq('publish_event_id', id)
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(100)

  const failedRows = failedRowsError ? [] : ((failedRowsData ?? []) as FailedRecipientRow[])
  const cycle = getOne(event.schedule_cycles)
  const publishedScheduleHref = buildScheduleUrl(event.cycle_id, 'week')

  return (
    <div className="space-y-6">
      {successParam === 'failed_requeued' && (
        <FeedbackToast
          variant="success"
          message={`Failed recipients re-queued: ${requeuedCount}.`}
        />
      )}
      {errorParam === 'requeue_failed' && (
        <FeedbackToast variant="error" message="Could not re-queue failed recipients." />
      )}

      <PageHeader
        title="Publish Details"
        subtitle={
          cycle
            ? `${cycle.label} | ${new Date(event.published_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
            : 'Schedule email delivery details.'
        }
        badge={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={event.status} />
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success-text)]" />
              {event.sent_count} sent
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-foreground">
              <CircleX className="h-3.5 w-3.5 text-[var(--error-text)]" />
              {event.failed_count} failed
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-foreground">
              <Clock3 className="h-3.5 w-3.5 text-[var(--warning-text)]" />
              {event.queued_count} queued
            </span>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={publishedScheduleHref}>
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                View schedule
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/publish">
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                History
              </Link>
            </Button>
            <ProcessQueuedButton publishEventId={event.id} />
          </div>
        }
      />

      {/* Event metadata */}
      <div className="rounded-xl border border-border bg-card shadow-tw-sm">
        <div className="border-b border-border px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Event summary
          </p>
        </div>
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {/* Left column */}
          <div className="divide-y divide-border px-5">
            <StatRow label="Cycle" value={cycle?.label ?? event.cycle_id} />
            {cycle && (
              <StatRow label="Cycle range" value={`${cycle.start_date} -> ${cycle.end_date}`} />
            )}
            <StatRow label="Published by" value={getOne(event.profiles)?.full_name ?? 'Manager'} />
            <StatRow label="Channel" value={event.channel} />
          </div>
          {/* Right column: delivery counts */}
          <div className="divide-y divide-border px-5">
            <StatRow label="Recipients" value={event.recipient_count} />
            <StatRow label="Queued" value={event.queued_count} />
            <StatRow
              label="Sent"
              value={
                <span style={{ color: 'var(--success-text)' }} className="font-semibold">
                  {event.sent_count}
                </span>
              }
            />
            <StatRow
              label="Failed"
              value={
                event.failed_count > 0 ? (
                  <span style={{ color: 'var(--error-text)' }} className="font-semibold">
                    {event.failed_count}
                  </span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )
              }
            />
          </div>
        </div>

        {event.error_message && (
          <div
            className="m-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--warning-border)',
              backgroundColor: 'var(--warning-subtle)',
              color: 'var(--warning-text)',
            }}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{event.error_message}</span>
          </div>
        )}
      </div>

      {/* Failed recipients */}
      <div className="rounded-xl border border-border bg-card shadow-tw-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Failed recipients
          </p>
          <form action={requeueFailedPublishEmailsAction}>
            <input type="hidden" name="publish_event_id" value={event.id} />
            <Button type="submit" size="sm" variant="outline" disabled={event.failed_count <= 0}>
              Re-send failed
            </Button>
          </form>
        </div>

        {failedRows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No failed recipients</p>
            <p className="text-xs text-muted-foreground">All emails were delivered successfully.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3 text-right">Attempts</th>
                  <th className="px-4 py-3">Last error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {failedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-secondary/20">
                    <td className="px-4 py-2.5 text-sm text-foreground">{row.email}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {row.name ?? '--'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-foreground">
                      {row.attempt_count}
                    </td>
                    <td className="max-w-[30rem] break-words px-4 py-2.5 text-sm text-muted-foreground">
                      {row.last_error ? (
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: 'var(--error-subtle)',
                            color: 'var(--error-text)',
                          }}
                        >
                          {row.last_error}
                        </span>
                      ) : (
                        '--'
                      )}
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
