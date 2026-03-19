'use client'

import type { PreliminaryHistoryItem } from '@/lib/preliminary-schedule/types'

type PreliminaryRequestHistoryProps = {
  items: PreliminaryHistoryItem[]
  cancelAction: (formData: FormData) => void | Promise<void>
}

function formatHistoryLabel(item: PreliminaryHistoryItem) {
  const parsed = new Date(`${item.shiftDate}T00:00:00`)
  const base = Number.isNaN(parsed.getTime())
    ? item.shiftDate
    : parsed.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })

  return `${base} - ${item.shiftType === 'day' ? 'Day' : 'Night'}`
}

export function PreliminaryRequestHistory({ items, cancelAction }: PreliminaryRequestHistoryProps) {
  return (
    <section className="rounded-xl border border-border bg-card px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-sm font-semibold text-foreground">Request history</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No preliminary requests yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-background px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.requestType === 'claim_open_shift'
                      ? 'Claimed open shift'
                      : 'Requested change'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatHistoryLabel(item)}</p>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.status.replace('_', ' ')}
                </span>
              </div>
              {item.note && <p className="mt-2 text-sm text-foreground">{item.note}</p>}
              {item.status === 'pending' && (
                <form action={cancelAction} className="mt-3">
                  <input type="hidden" name="request_id" value={item.requestId} />
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition hover:bg-muted"
                  >
                    Cancel request
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
