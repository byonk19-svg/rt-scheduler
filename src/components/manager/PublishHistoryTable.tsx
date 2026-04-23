'use client'

import Link from 'next/link'
import { ArrowRight, Send, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

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

export function PublishHistoryTable({
  deletePublishEventAction,
  events,
}: {
  deletePublishEventAction: (formData: FormData) => void | Promise<void>
  events: PublishEventRow[]
}) {
  return (
    <div className="space-y-2">
      <div className="px-0.5">
        <h2 className="text-sm font-bold tracking-tight text-foreground">
          Publish delivery history
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          One row per time a schedule was published and emails were queued. Deleting a row here only
          removes the log entry, not the schedule block itself.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-tw-sm">
        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted">
              <Send className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">No publish events yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Publish a schedule from the finalize schedule page to see delivery history here.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/publish">Go to finalize schedule</Link>
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
                        {!getOne(event.schedule_cycles)?.published ? (
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
                        ) : null}
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
  )
}
