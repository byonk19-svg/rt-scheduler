import { cn } from '@/lib/utils'

type CycleFillRateRow = {
  cycleId: string
  label: string
  dateRange: string
  fillPercent: number
  scheduledCount: number
  totalSlots: number
}

type Props = {
  rows: CycleFillRateRow[]
  idealCoveragePerShift: number
}

function fillBarClass(pct: number) {
  if (pct >= 80) return 'bg-[var(--success)]'
  if (pct >= 50) return 'bg-[var(--warning)]'
  return 'bg-[var(--error)]'
}

function fillTextClass(pct: number) {
  if (pct >= 80) return 'text-[var(--success-text)]'
  if (pct >= 50) return 'text-[var(--warning-text)]'
  return 'text-[var(--error-text)]'
}

function truncateLabel(label: string, max = 48): string {
  if (label.length <= max) return label
  return label.slice(0, max) + '…'
}

export function CycleFillRateChart({ rows, idealCoveragePerShift }: Props) {
  const avg =
    rows.length > 0
      ? Math.round(rows.reduce((sum, r) => sum + r.fillPercent, 0) / rows.length)
      : null

  return (
    <section className="rounded-xl border border-border bg-card shadow-tw-sm">
      <div className="flex items-baseline justify-between gap-4 border-b border-border px-5 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Schedule Block fill rates
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Target: {idealCoveragePerShift} therapists per shift slot.
          </p>
        </div>
        {avg !== null ? (
          <p className={cn('shrink-0 text-sm font-semibold tabular-nums', fillTextClass(avg))}>
            {avg}% avg
          </p>
        ) : null}
      </div>
      <div className="space-y-4 px-5 py-4">
        {rows.map((row) => (
          <div key={row.cycleId} className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {truncateLabel(row.label)}
                </p>
                <p className="text-xs text-muted-foreground">{row.dateRange}</p>
              </div>
              <p
                className={cn(
                  'shrink-0 text-sm font-bold tabular-nums',
                  fillTextClass(row.fillPercent)
                )}
              >
                {row.fillPercent}%
              </p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  'h-full rounded-full transition-[width]',
                  fillBarClass(row.fillPercent)
                )}
                style={{ width: `${Math.max(0, Math.min(row.fillPercent, 100))}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {row.scheduledCount} of {row.totalSlots} slots filled
            </p>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No Schedule Blocks found.</p>
        ) : null}
      </div>
    </section>
  )
}
