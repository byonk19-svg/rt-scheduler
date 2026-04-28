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

export function CycleFillRateChart({ rows, idealCoveragePerShift }: Props) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-tw-sm">
      <div className="border-b border-border px-5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Cycle fill rates
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Using ideal coverage target of {idealCoveragePerShift} therapists per shift.
        </p>
      </div>
      <div className="space-y-4 px-5 py-4">
        {rows.map((row) => (
          <div key={row.cycleId} className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.dateRange}</p>
              </div>
              <p className="text-sm font-bold text-[var(--error)]">{row.fillPercent}% filled</p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-light">
              <div
                className="h-full rounded-full bg-[var(--error)] transition-[width]"
                style={{ width: `${Math.max(0, Math.min(row.fillPercent, 100))}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {row.scheduledCount} scheduled / {row.totalSlots} target slots
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
