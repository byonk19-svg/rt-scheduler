'use client'

import Link from 'next/link'
import { Archive, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatDateLabel } from '@/lib/calendar-utils'

type CycleRow = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
}

export function FinalizeScheduleBlocksTable({
  archiveCycleAction,
  cycles,
  cyclesLoadError,
  deleteCycleAction,
  restartPublishedCycleAction,
  unpublishCycleKeepShiftsAction,
}: {
  archiveCycleAction: (formData: FormData) => void | Promise<void>
  cycles: CycleRow[]
  cyclesLoadError: unknown
  deleteCycleAction: (formData: FormData) => void | Promise<void>
  restartPublishedCycleAction: (formData: FormData) => void | Promise<void>
  unpublishCycleKeepShiftsAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <div className="space-y-2">
      <div className="px-0.5">
        <h2 className="text-sm font-bold tracking-tight text-foreground">
          Schedule blocks to finalize
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Use this page to decide whether a block should go live, go back to draft, or be archived
          once it is no longer needed.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-tw-sm">
        {cyclesLoadError ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Could not load schedule blocks. Refresh, or run database migrations.
          </div>
        ) : cycles.length === 0 ? (
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
                {cycles.map((cycle) => (
                  <tr key={cycle.id} className="align-middle">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{cycle.label}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDateLabel(cycle.start_date)} - {formatDateLabel(cycle.end_date)}
                    </td>
                    <td className="px-4 py-3">
                      {cycle.published ? (
                        <span className="text-[11px] font-semibold text-[var(--success-text)]">
                          Live
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-muted-foreground">Draft</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/coverage?cycle=${cycle.id}&view=week`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          {cycle.published ? 'Open in schedule' : 'Open to publish'}
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
                                Clear &amp; restart
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
  )
}
