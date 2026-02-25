import Link from 'next/link'
import { redirect } from 'next/navigation'

import { FeedbackToast } from '@/components/feedback-toast'
import { parseCount } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/server'
import { ProcessQueuedButton } from '@/app/publish/process-queued-button'
import { requeueFailedPublishEmailsAction } from '@/app/publish/actions'

type ProfileRoleRow = {
  role: string | null
}

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

  if ((profile as ProfileRoleRow | null)?.role !== 'manager') {
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
      <div className="mx-auto w-full max-w-4xl space-y-4 py-6">
        <h1 className="text-2xl font-bold text-foreground">Publish details</h1>
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Could not load publish event.
        </p>
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

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 py-6">
      {successParam === 'failed_requeued' && (
        <FeedbackToast
          variant="success"
          message={`Failed recipients re-queued: ${requeuedCount}.`}
        />
      )}
      {errorParam === 'requeue_failed' && (
        <FeedbackToast variant="error" message="Could not re-queue failed recipients." />
      )}

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-foreground">Publish details</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/publish"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Back to history
          </Link>
          <ProcessQueuedButton publishEventId={event.id} />
        </div>
      </div>

      <div className="rounded-md border border-border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <p className="text-sm text-muted-foreground">Event ID: <span className="font-medium text-foreground">{event.id}</span></p>
          <p className="text-sm text-muted-foreground">Cycle: <span className="font-medium text-foreground">{cycle?.label ?? event.cycle_id}</span></p>
          <p className="text-sm text-muted-foreground">Published at: <span className="font-medium text-foreground">{new Date(event.published_at).toLocaleString('en-US')}</span></p>
          <p className="text-sm text-muted-foreground">Published by: <span className="font-medium text-foreground">{getOne(event.profiles)?.full_name ?? 'Manager'}</span></p>
          <p className="text-sm text-muted-foreground">Recipients: <span className="font-medium text-foreground">{event.recipient_count}</span></p>
          <p className="text-sm text-muted-foreground">Channel: <span className="font-medium text-foreground">{event.channel}</span></p>
          <p className="text-sm text-muted-foreground">Queued: <span className="font-medium text-foreground">{event.queued_count}</span></p>
          <p className="text-sm text-muted-foreground">Sent: <span className="font-medium text-foreground">{event.sent_count}</span></p>
          <p className="text-sm text-muted-foreground">Failed: <span className="font-medium text-foreground">{event.failed_count}</span></p>
          <p className="text-sm text-muted-foreground">Status: <span className="font-medium text-foreground">{event.status}</span></p>
        </div>

        {cycle && (
          <p className="mt-3 text-sm text-muted-foreground">
            Cycle range: <span className="font-medium text-foreground">{cycle.start_date} to {cycle.end_date}</span>
          </p>
        )}

        {event.error_message && (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {event.error_message}
          </p>
        )}
      </div>

      <div className="rounded-md border border-border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Failed recipients</h2>
          <form action={requeueFailedPublishEmailsAction}>
            <input type="hidden" name="publish_event_id" value={event.id} />
            <button
              type="submit"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
              disabled={event.failed_count <= 0}
            >
              Re-send failed
            </button>
          </form>
        </div>

        {failedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No failed recipients.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Attempts</th>
                  <th className="px-3 py-2">Last error</th>
                </tr>
              </thead>
              <tbody>
                {failedRows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 text-sm text-foreground">{row.email}</td>
                    <td className="px-3 py-2 text-sm text-foreground">{row.name ?? '-'}</td>
                    <td className="px-3 py-2 text-sm text-foreground">{row.attempt_count}</td>
                    <td className="px-3 py-2 text-sm text-foreground">{row.last_error ?? '-'}</td>
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

