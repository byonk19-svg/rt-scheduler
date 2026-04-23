'use client'

import { Mail } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

type FailedRecipientRow = {
  id: string
  email: string
  name: string | null
  attempt_count: number
  last_error: string | null
  created_at: string
}

function OutboxRecipientTable({ rows }: { rows: FailedRecipientRow[] }) {
  return (
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
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-secondary/20">
              <td className="px-4 py-2.5 text-sm text-foreground">{row.email}</td>
              <td className="px-4 py-2.5 text-sm text-muted-foreground">{row.name ?? '--'}</td>
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
  )
}

function QueuedRecipientsEmpty() {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted">
        <Mail className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">No queued recipients</p>
      <p className="text-xs text-muted-foreground">
        There are no outbound emails waiting for this event.
      </p>
    </div>
  )
}

export function PublishEventRecipientPanels({
  eventId,
  failedPage,
  failedRows,
  id,
  query,
  queuedRows,
  requeueFailedPublishEmailsAction,
  totalFailed,
  totalFailedPages,
}: {
  eventId: string
  failedPage: number
  failedRows: FailedRecipientRow[]
  id: string
  query:
    | {
        success?: string | string[]
        error?: string | string[]
        requeued?: string | string[]
        page?: string | string[]
      }
    | undefined
  queuedRows: FailedRecipientRow[]
  requeueFailedPublishEmailsAction: (formData: FormData) => void | Promise<void>
  totalFailed: number
  totalFailedPages: number
}) {
  function getSearchParam(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) return value[0]
    return value
  }

  function publishDetailHref(page: number): string {
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

  const failedOffset = (failedPage - 1) * 25

  return (
    <>
      <div className="rounded-xl border border-border bg-card shadow-tw-sm">
        <details>
          <summary className="cursor-pointer border-b border-border px-5 py-3">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Queued recipients ({queuedRows.length})
            </span>
          </summary>
          {queuedRows.length === 0 ? (
            <QueuedRecipientsEmpty />
          ) : (
            <OutboxRecipientTable rows={queuedRows} />
          )}
        </details>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-tw-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Failed recipients
          </p>
          <form action={requeueFailedPublishEmailsAction}>
            <input type="hidden" name="publish_event_id" value={eventId} />
            <Button type="submit" size="sm" variant="outline" disabled={totalFailed <= 0}>
              Re-send failed
            </Button>
          </form>
        </div>

        {totalFailed === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No failed recipients</p>
            <p className="text-xs text-muted-foreground">All emails were delivered successfully.</p>
          </div>
        ) : (
          <>
            <OutboxRecipientTable rows={failedRows} />
            {totalFailedPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                <p className="text-xs text-muted-foreground">
                  Page {failedPage} of {totalFailedPages}
                  <span className="text-muted-foreground/80">
                    {' '}
                    ({totalFailed} total
                    {totalFailed > 0
                      ? ` — showing ${failedOffset + 1}–${Math.min(failedOffset + 25, totalFailed)}`
                      : ''}
                    )
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  {failedPage <= 1 ? (
                    <Button size="sm" variant="outline" disabled>
                      Previous
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link href={publishDetailHref(failedPage - 1)}>Previous</Link>
                    </Button>
                  )}
                  {failedPage >= totalFailedPages ? (
                    <Button size="sm" variant="outline" disabled>
                      Next
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link href={publishDetailHref(failedPage + 1)}>Next</Link>
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}
