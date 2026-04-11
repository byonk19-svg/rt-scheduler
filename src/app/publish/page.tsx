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
  restartPublishedCycleAction,
  unpublishCycleKeepShiftsAction,
} from '@/app/publish/actions'
import { deleteCycleAction } from '@/app/schedule/actions'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { formatDateLabel } from '@/lib/calendar-utils'
import { fetchScheduleCyclesForCoverage } from '@/lib/coverage/fetch-schedule-cycles'
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!can(parseRole(profile?.role), 'manage_publish')) {
    redirect('/dashboard')
  }

  const { data: activeCycles, error: cyclesLoadError } =
    await fetchScheduleCyclesForCoverage(supabase)

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
  const hasDraftCycles = !cyclesLoadError && (activeCycles ?? []).some((cycle) => !cycle.published)

  return (
    <div className="space-y-5">
      <div className="border-b border-border bg-card px-6 pb-4 pt-5">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
              Publish History
            </h1>
            <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
              Manage 6-week schedule blocks (the same list as on Schedule) and review email delivery
              when you publish.
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

      {resolvedSearchParams.success === 'cycle_restarted' && (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--warning-border)',
            backgroundColor: 'var(--warning-subtle)',
            color: 'var(--warning-text)',
          }}
        >
          Cycle restarted. The block is draft again, published shifts were cleared, and any active
          preliminary snapshot was closed.
        </div>
      )}

      {resolvedSearchParams.success === 'unpublished_keep_shifts' && (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--success-border)',
            backgroundColor: 'var(--success-subtle)',
            color: 'var(--success-text)',
          }}
        >
          Block unpublished. Assignments stay on the draft grid; staff no longer see it as a
          published schedule until you publish again.
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
          Cycle archived. It will no longer appear in Coverage or availability views.
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
          Draft schedule block deleted.
        </div>
      )}

      {(resolvedSearchParams.error === 'missing_cycle' ||
        resolvedSearchParams.error === 'cycle_restart_failed' ||
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
            ? 'Could not restart that cycle because no cycle was selected.'
            : resolvedSearchParams.error === 'cycle_restart_failed'
              ? 'Could not restart that published cycle. Please try again.'
              : resolvedSearchParams.error === 'unpublish_keep_shifts_failed'
                ? 'Could not unpublish that block while keeping shifts. Please try again.'
                : resolvedSearchParams.error === 'unpublish_not_live'
                  ? 'That block is already a draft.'
                  : resolvedSearchParams.error === 'delete_live_publish_event'
                    ? 'Live publish entries must be restarted from the schedule workspace before they can be removed from history.'
                    : resolvedSearchParams.error === 'missing_publish_event'
                      ? 'Could not delete that history entry because no publish event was selected.'
                      : resolvedSearchParams.error === 'delete_publish_event_failed'
                        ? 'Could not delete that publish history entry. Please try again.'
                        : resolvedSearchParams.error === 'archive_live_cycle'
                          ? 'Live blocks must be unpublished or cleared with Start over before they can be archived.'
                          : resolvedSearchParams.error === 'cycle_archive_failed'
                            ? 'Could not archive that cycle. Please try again.'
                            : resolvedSearchParams.error === 'delete_cycle_unauthorized'
                              ? 'You do not have permission to delete that schedule block.'
                              : resolvedSearchParams.error === 'delete_cycle_not_found'
                                ? 'That schedule block was not found.'
                                : resolvedSearchParams.error === 'delete_cycle_published'
                                  ? 'Published blocks cannot be deleted. Unpublish (keep shifts) or Start over, then archive or delete the draft.'
                                  : resolvedSearchParams.error === 'delete_cycle_failed'
                                    ? 'Could not delete that draft block. Please try again.'
                                    : 'Something went wrong.'}
        </div>
      )}

      {hasDraftCycles && (
        <div
          className="rounded-xl border px-4 py-3"
          style={{
            borderColor: 'var(--info-border)',
            backgroundColor: 'var(--info-subtle)',
            color: 'var(--info-text)',
          }}
        >
          <p className="text-xs font-semibold">Ready to publish a draft?</p>
          <p className="mt-0.5 text-xs">
            Open the cycle in Schedule using the link below, then click <strong>Publish</strong> in
            the action bar. This page only shows delivery history after publishing.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="px-0.5">
          <h2 className="text-sm font-bold tracking-tight text-foreground">Schedule blocks</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Live blocks: Unpublish (keep shifts) takes them offline but keeps assignments; Start
            over clears the grid and returns to draft. Drafts: archive hides from Schedule, delete
            removes the block. Email log is below.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {cyclesLoadError ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Could not load schedule blocks. Refresh, or run database migrations.
            </div>
          ) : activeCycles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No active schedule blocks</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Create a block from the Schedule page, or archived blocks are hidden here.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/coverage?view=week">Go to schedule</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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
                        ) : (
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/coverage?cycle=${cycle.id}&view=week`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            {cycle.published ? 'Open in Schedule' : 'Open to publish'}
                          </Link>
                          {cycle.published ? (
                            <>
                              <form action={unpublishCycleKeepShiftsAction}>
                                <input type="hidden" name="cycle_id" value={cycle.id} />
                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition-opacity hover:opacity-80"
                                >
                                  Take offline
                                </button>
                              </form>
                              <form action={restartPublishedCycleAction}>
                                <input type="hidden" name="cycle_id" value={cycle.id} />
                                <button
                                  type="submit"
                                  title="Draft again and clear all assignments for this block"
                                  className="inline-flex h-8 items-center rounded-md border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 text-xs font-semibold text-[var(--warning-text)] transition-opacity hover:opacity-80"
                                >
                                  Clear & restart
                                </button>
                              </form>
                            </>
                          ) : (
                            <>
                              <form action={archiveCycleAction}>
                                <input type="hidden" name="cycle_id" value={cycle.id} />
                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs font-semibold text-foreground transition-opacity hover:opacity-80"
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
                                  className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 text-xs font-semibold text-[var(--error-text)] transition-opacity hover:opacity-80"
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
            only removes the log entry, not the schedule block—use Schedule blocks above to archive.
          </p>
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
                    <tr key={event.id} className="group align-top">
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
                              <form action={unpublishCycleKeepShiftsAction}>
                                <input type="hidden" name="cycle_id" value={event.cycle_id} />
                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition-opacity hover:opacity-80"
                                >
                                  Take offline
                                </button>
                              </form>
                              <form action={restartPublishedCycleAction}>
                                <input type="hidden" name="cycle_id" value={event.cycle_id} />
                                <button
                                  type="submit"
                                  title="Draft again and clear all assignments for this block"
                                  className="inline-flex h-8 items-center rounded-md border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 text-xs font-semibold text-[var(--warning-text)] transition-opacity hover:opacity-80"
                                >
                                  Clear & restart
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
                                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs font-semibold text-foreground transition-opacity hover:opacity-80"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                  Archive cycle
                                </button>
                              </form>
                              <form action={deletePublishEventAction}>
                                <input type="hidden" name="publish_event_id" value={event.id} />
                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 text-xs font-semibold text-[var(--error-text)] transition-opacity hover:opacity-80"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete history
                                </button>
                              </form>
                            </>
                          )}
                          <Link
                            href={`/coverage?cycle=${event.cycle_id}&view=week`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            Open cycle
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
