import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Archive,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleX,
  Clock3,
  Send,
  Trash2,
} from 'lucide-react'

import {
  archiveCycleAction,
  deletePublishEventAction,
  takeScheduleBlockOfflineAction,
} from '@/app/publish/actions'
import { deleteCycleAction, toggleCyclePublishedAction } from '@/app/schedule/actions'
import { ManagerToolAccessDenied } from '@/components/auth/ManagerToolAccessDenied'
import { resolveManagerToolAccess } from '@/lib/auth/manager-tool-access'
import { formatDateLabel } from '@/lib/calendar-utils'
import { fetchScheduleCyclesForCoverage } from '@/lib/coverage/fetch-schedule-cycles'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Publish History',
  description: 'Manage Schedule Blocks and review publish email delivery history.',
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
        status: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
      }
    | {
        label: string
        published: boolean
        status: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
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

const publishEventDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatPublishEventTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return publishEventDateFormatter.format(date)
}

type PublishHistoryPageProps = {
  searchParams?: Promise<{
    success?: string
    error?: string
  }>
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
    .select('role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  const access = resolveManagerToolAccess(profile, 'manage_publish')
  if (access === 'inactive') redirect('/login?error=account_inactive')
  if (access === 'forbidden') return <ManagerToolAccessDenied toolName="Publish History" />

  const activeCyclesPromise = fetchScheduleCyclesForCoverage(supabase)
  const eventsResult = await supabase
    .from('publish_events')
    .select(
      'id, cycle_id, published_at, status, recipient_count, channel, queued_count, sent_count, failed_count, error_message, schedule_cycles(label,published,status), profiles!publish_events_published_by_fkey(full_name)'
    )
    .order('published_at', { ascending: false })
    .limit(50)
  const { data: eventsData, error: eventsError } = eventsResult

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

  const { data: activeCycles, error: cyclesLoadError } = await activeCyclesPromise
  const events = (eventsData ?? []) as PublishEventRow[]
  const successCount = events.filter((event) => event.status === 'success').length
  const failedCount = events.filter((event) => event.status === 'failed').length
  const queuedCount = events.reduce((total, event) => total + Math.max(event.queued_count, 0), 0)
  const hasDraftCycles = !cyclesLoadError && (activeCycles ?? []).some((cycle) => !cycle.published)

  return (
    <div className="space-y-5">
      <div className="border-b border-border bg-card px-6 pb-4 pt-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
              Publish History
            </h1>
            <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
              Manage Schedule Blocks (the same list as on Schedule) and review email delivery when
              you publish.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link href="/schedule">
                <CalendarDays className="h-3.5 w-3.5" />
                Back to schedule
              </Link>
            </Button>
          </div>
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

      {resolvedSearchParams.success === 'cycle_taken_offline' && (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--success-border)',
            backgroundColor: 'var(--success-subtle)',
            color: 'var(--success-text)',
          }}
        >
          Schedule Block taken offline. Assignments were preserved, staff live views are hidden, and
          new trade or coverage requests stay paused until you republish.
        </div>
      )}

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

      {resolvedSearchParams.success === 'cycle_archived' && (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--success-border)',
            backgroundColor: 'var(--success-subtle)',
            color: 'var(--success-text)',
          }}
        >
          Schedule Block archived. It will no longer appear in Schedule or availability views.
        </div>
      )}

      {resolvedSearchParams.success === 'cycle_deleted' && (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--success-border)',
            backgroundColor: 'var(--success-subtle)',
            color: 'var(--success-text)',
          }}
        >
          Draft Schedule Block deleted.
        </div>
      )}

      {(resolvedSearchParams.error === 'missing_cycle' ||
        resolvedSearchParams.error === 'cycle_restart_failed' ||
        resolvedSearchParams.error === 'start_over_after_final_blocked' ||
        resolvedSearchParams.error === 'take_offline_failed' ||
        resolvedSearchParams.error === 'take_offline_not_live' ||
        resolvedSearchParams.error === 'take_offline_state_changed' ||
        resolvedSearchParams.error === 'unpublish_keep_shifts_failed' ||
        resolvedSearchParams.error === 'unpublish_not_live' ||
        resolvedSearchParams.error === 'delete_publish_event_failed' ||
        resolvedSearchParams.error === 'delete_live_publish_event' ||
        resolvedSearchParams.error === 'missing_publish_event' ||
        resolvedSearchParams.error === 'archive_live_cycle' ||
        resolvedSearchParams.error === 'cycle_archive_failed' ||
        resolvedSearchParams.error === 'delete_cycle_unauthorized' ||
        resolvedSearchParams.error === 'delete_cycle_not_found' ||
        resolvedSearchParams.error === 'delete_cycle_published' ||
        resolvedSearchParams.error === 'delete_cycle_not_draft' ||
        resolvedSearchParams.error === 'delete_cycle_not_empty' ||
        resolvedSearchParams.error === 'delete_cycle_failed') && (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--error-border)',
            backgroundColor: 'var(--error-subtle)',
            color: 'var(--error-text)',
          }}
        >
          {resolvedSearchParams.error === 'missing_cycle'
            ? 'Could not change that Schedule Block because no Schedule Block was selected.'
            : resolvedSearchParams.error === 'start_over_after_final_blocked'
              ? 'Published Schedule Blocks cannot be started over. Take the Schedule Block offline or make post-publish edits instead.'
              : resolvedSearchParams.error === 'take_offline_failed'
                ? 'Could not take that Schedule Block offline. Please try again.'
                : resolvedSearchParams.error === 'take_offline_not_live'
                  ? 'Only live Final Schedule Blocks can be taken offline.'
                  : resolvedSearchParams.error === 'take_offline_state_changed'
                    ? 'That Schedule Block changed before it could be taken offline. Refresh and try again.'
                    : resolvedSearchParams.error === 'cycle_restart_failed'
                      ? 'Could not restart that published Schedule Block. Please try again.'
                      : resolvedSearchParams.error === 'unpublish_keep_shifts_failed'
                        ? 'Could not unpublish that Schedule Block while keeping shifts. Please try again.'
                        : resolvedSearchParams.error === 'unpublish_not_live'
                          ? 'That Schedule Block is already a draft.'
                          : resolvedSearchParams.error === 'delete_live_publish_event'
                            ? 'Live publish entries must be restarted from Schedule before they can be removed from history.'
                            : resolvedSearchParams.error === 'missing_publish_event'
                              ? 'Could not delete that history entry because no publish event was selected.'
                              : resolvedSearchParams.error === 'delete_publish_event_failed'
                                ? 'Could not delete that publish history entry. Please try again.'
                                : resolvedSearchParams.error === 'archive_live_cycle'
                                  ? 'Live Schedule Blocks must be taken offline before they can be archived.'
                                  : resolvedSearchParams.error === 'cycle_archive_failed'
                                    ? 'Could not archive that Schedule Block. Please try again.'
                                    : resolvedSearchParams.error === 'delete_cycle_unauthorized'
                                      ? 'You do not have permission to delete that Schedule Block.'
                                      : resolvedSearchParams.error === 'delete_cycle_not_found'
                                        ? 'That Schedule Block was not found.'
                                        : resolvedSearchParams.error === 'delete_cycle_published'
                                          ? 'Published Schedule Blocks cannot be deleted. Take the Schedule Block offline or use post-publish edits instead.'
                                          : resolvedSearchParams.error === 'delete_cycle_not_draft'
                                            ? 'Only empty unpublished Draft Schedule Blocks can be deleted.'
                                            : resolvedSearchParams.error ===
                                                'delete_cycle_not_empty'
                                              ? 'This Schedule Block already has schedule, availability, preliminary, or publish history. Archive it instead of deleting it.'
                                              : resolvedSearchParams.error === 'delete_cycle_failed'
                                                ? 'Could not delete that draft Schedule Block. Please try again.'
                                                : 'Something went wrong.'}
        </div>
      )}

      {hasDraftCycles && (
        <div className="rounded-[10px] border border-[var(--info-border)] bg-[var(--info-subtle)] px-4 py-3 text-sm text-[var(--info-text)]">
          <p className="font-semibold">Ready to publish a draft?</p>
          <p className="mt-0.5">
            Open the Schedule Block in Schedule using the link below, then click{' '}
            <strong>Publish</strong> in the action bar. This page only shows delivery history after
            publishing.
          </p>
        </div>
      )}

      <section
        aria-label="Publish checklist"
        className="rounded-xl border border-border bg-card px-4 py-4 shadow-tw-sm"
      >
        <div className="mb-3">
          <h2 className="text-sm font-bold tracking-tight text-foreground">Publish checklist</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Use this page after a schedule has been sent. Start publishing from Schedule.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-md border border-border/70 bg-background px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              1. Send from Schedule
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Run Pre-flight, then publish from the Schedule action bar.
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              2. Check delivery
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Review sent, failed, and queued email counts here.
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              3. Manage lifecycle
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Take live blocks offline before archiving or cleaning up history.
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-2">
        <div className="px-0.5">
          <h2 className="text-sm font-bold tracking-tight text-foreground">Schedule Blocks</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Live Schedule Blocks can be taken offline without deleting assignments. Offline Schedule
            Blocks can be republished after validation. Drafts can be archived or safely deleted
            when empty. Email log is below.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-tw-sm">
          {cyclesLoadError ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Could not load Schedule Blocks. Refresh, or contact an admin if this continues.
            </div>
          ) : activeCycles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No active Schedule Blocks</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Create a Schedule Block from the Schedule page. Archived Schedule Blocks stay hidden
                here.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/schedule">Go to schedule</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <th className="px-4 py-3">Block</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeCycles.map((cycle) => (
                    <tr key={cycle.id} className="align-middle">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {cycle.label}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDateLabel(cycle.start_date)} – {formatDateLabel(cycle.end_date)}
                      </td>
                      <td className="px-4 py-3">
                        {cycle.published ? (
                          <span className="text-[11px] font-semibold text-[var(--success-text)]">
                            Live
                          </span>
                        ) : cycle.status === 'offline' ? (
                          <span className="text-[11px] font-semibold text-[var(--warning-text)]">
                            Offline
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {cycle.status === 'preliminary' ? 'Preliminary' : 'Draft'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/schedule?cycle=${cycle.id}`}
                            className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground no-underline hover:no-underline"
                          >
                            {cycle.published ? 'Open in Schedule' : 'Open to publish'}
                          </Link>
                          {cycle.published ? (
                            <>
                              <form action={takeScheduleBlockOfflineAction}>
                                <input type="hidden" name="cycle_id" value={cycle.id} />
                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                                >
                                  Take offline
                                </button>
                              </form>
                            </>
                          ) : cycle.status === 'offline' ? (
                            <form action={toggleCyclePublishedAction}>
                              <input type="hidden" name="cycle_id" value={cycle.id} />
                              <input type="hidden" name="view" value="week" />
                              <input type="hidden" name="show_unavailable" value="false" />
                              <input type="hidden" name="currently_published" value="false" />
                              <input type="hidden" name="override_weekly_rules" value="false" />
                              <input type="hidden" name="override_shift_rules" value="false" />
                              <input type="hidden" name="return_to" value="coverage" />
                              <button
                                type="submit"
                                className="inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                              >
                                Republish
                              </button>
                            </form>
                          ) : (
                            <>
                              <form action={archiveCycleAction}>
                                <input type="hidden" name="cycle_id" value={cycle.id} />
                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                  Archive
                                </button>
                              </form>
                              <form action={deleteCycleAction}>
                                <input type="hidden" name="cycle_id" value={cycle.id} />
                                <input type="hidden" name="return_to" value="publish" />
                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-semibold text-[var(--error)] transition-colors hover:bg-muted hover:text-[var(--error)]"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete draft
                                </button>
                              </form>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <div className="px-0.5">
          <h2 className="text-sm font-bold tracking-tight text-foreground">Publish email log</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            One row per time a schedule was published and emails were queued. Deleting a row here
            only removes the log entry, not the Schedule Block. Use Schedule Blocks above to
            archive.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-tw-sm">
          {events.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Send className="h-12 w-12 text-muted-foreground" />
              <p className="text-base font-semibold">No publish events yet</p>
              <Button asChild variant="default">
                <Link href="/schedule">Go to schedule</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <th className="px-4 py-3">Published at</th>
                    <th className="px-4 py-3">Schedule Block</th>
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
                    <tr key={event.id} className="group align-top">
                      <td className="px-4 py-3 text-sm text-foreground">
                        {formatPublishEventTime(event.published_at)}
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
                        <div className="flex flex-col items-start gap-1.5">
                          <StatusChip status={event.status} />
                          {getOne(event.schedule_cycles)?.published ? (
                            <span className="text-[11px] font-medium text-[var(--success-text)]">
                              Currently live
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-muted-foreground">
                              No longer live
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {getOne(event.schedule_cycles)?.published && (
                            <>
                              <form action={takeScheduleBlockOfflineAction}>
                                <input type="hidden" name="cycle_id" value={event.cycle_id} />
                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                                >
                                  Take offline
                                </button>
                              </form>
                            </>
                          )}
                          {!getOne(event.schedule_cycles)?.published && (
                            <>
                              <form action={archiveCycleAction}>
                                <input type="hidden" name="cycle_id" value={event.cycle_id} />
                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                  Archive Schedule Block
                                </button>
                              </form>
                              <form action={deletePublishEventAction}>
                                <input type="hidden" name="publish_event_id" value={event.id} />
                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-semibold text-[var(--error)] transition-colors hover:bg-muted hover:text-[var(--error)]"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete history
                                </button>
                              </form>
                            </>
                          )}
                          <Link
                            href={`/schedule?cycle=${event.cycle_id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            Open Schedule Block
                          </Link>
                          <Link
                            href={`/publish/${event.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            Details
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
