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
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { PublishEventRecipientPanels } from '@/components/manager/PublishEventRecipientPanels'
import { PublishEventSummaryCard } from '@/components/manager/PublishEventSummaryCard'
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
  page?: string | string[]
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

const FAILED_PAGE_SIZE = 25

function publishDetailHref(
  id: string,
  query: DetailSearchParams | undefined,
  page: number
): string {
  const params = new URLSearchParams()
  const success = getSearchParam(query?.success)
  const error = getSearchParam(query?.error)
  const requeued = getSearchParam(query?.requeued)
  if (success) params.set('success', success)
  if (error) params.set('error', error)
  if (requeued) params.set('requeued', requeued)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `/publish/${id}?${qs}` : `/publish/${id}`
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
  const pageParam = getSearchParam(query?.page)
  const parsedPage = parseInt(pageParam ?? '1', 10)
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1

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
        <ManagerWorkspaceHeader
          title="Publish Details"
          subtitle="Schedule email delivery details."
        />
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

  const { count: failedTotalCount, error: failedCountError } = await supabase
    .from('notification_outbox')
    .select('*', { count: 'exact', head: true })
    .eq('publish_event_id', id)
    .eq('status', 'failed')

  const totalFailed = failedCountError ? 0 : (failedTotalCount ?? 0)
  const totalFailedPages = totalFailed === 0 ? 1 : Math.ceil(totalFailed / FAILED_PAGE_SIZE)
  const failedPage = Math.min(currentPage, totalFailedPages)
  if (currentPage !== failedPage) {
    redirect(publishDetailHref(id, query, failedPage))
  }
  const failedOffset = (failedPage - 1) * FAILED_PAGE_SIZE

  const { data: failedRowsData, error: failedRowsError } = await supabase
    .from('notification_outbox')
    .select('id, email, name, attempt_count, last_error, created_at')
    .eq('publish_event_id', id)
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .range(failedOffset, failedOffset + FAILED_PAGE_SIZE - 1)

  const { data: queuedRowsData, error: queuedRowsError } = await supabase
    .from('notification_outbox')
    .select('id, email, name, attempt_count, last_error, created_at')
    .eq('publish_event_id', id)
    .eq('status', 'queued')
    .order('created_at', { ascending: false })

  const failedRows = failedRowsError ? [] : ((failedRowsData ?? []) as FailedRecipientRow[])
  const queuedRows = queuedRowsError ? [] : ((queuedRowsData ?? []) as FailedRecipientRow[])
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

      <PublishEventSummaryCard
        cycle={cycle}
        event={event}
        publishedScheduleHref={publishedScheduleHref}
      />
      <div className="flex justify-end">
        <ProcessQueuedButton publishEventId={event.id} />
      </div>

      <PublishEventRecipientPanels
        eventId={event.id}
        failedPage={failedPage}
        failedRows={failedRows}
        id={id}
        query={query}
        queuedRows={queuedRows}
        requeueFailedPublishEmailsAction={requeueFailedPublishEmailsAction}
        totalFailed={totalFailed}
        totalFailedPages={totalFailedPages}
      />
    </div>
  )
}
