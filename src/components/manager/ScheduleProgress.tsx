'use client'

import { Progress } from '@/components/ui/progress'

export function computeProgress(filled: number, total: number) {
  if (total === 0) return { pct: 0, gaps: 0 }

  return {
    pct: Math.round((filled / total) * 100),
    gaps: Math.max(total - filled, 0),
  }
}

type ScheduleProgressProps = {
  dayFilled: number
  dayTotal: number
  nightFilled: number
  nightTotal: number
}

export function ScheduleProgress({
  dayFilled,
  dayTotal,
  nightFilled,
  nightTotal,
}: ScheduleProgressProps) {
  const day = computeProgress(dayFilled, dayTotal)
  const night = computeProgress(nightFilled, nightTotal)
  const overallFilled = dayFilled + nightFilled
  const overallTotal = dayTotal + nightTotal
  const overall = computeProgress(overallFilled, overallTotal)
  const rows = [
    {
      label: 'Day Shifts',
      caption: 'Core daytime staffing',
      indicatorClassName: 'bg-primary',
      badgeClassName: 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]',
      ...day,
      filled: dayFilled,
      total: dayTotal,
    },
    {
      label: 'Night Shifts',
      caption: 'Overnight coverage load',
      indicatorClassName: 'bg-[var(--warning)]',
      badgeClassName:
        'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]',
      ...night,
      filled: nightFilled,
      total: nightTotal,
    },
  ]

  return (
    <div className="relative overflow-hidden rounded-[26px] border border-border/70 bg-card shadow-tw-panel">
      <div className="teamwise-grid-bg-subtle teamwise-aurora-bg absolute inset-x-0 top-0 h-28 opacity-45" />

      <div className="relative flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Coverage signal
          </p>
          <h3 className="font-heading text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
            Schedule Completion
          </h3>
        </div>
        <div className="rounded-full border border-border/70 bg-card px-3 py-1 text-right shadow-tw-md">
          <p className="font-heading text-sm font-semibold leading-none text-foreground">
            {overall.pct}%
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Overall
          </p>
        </div>
      </div>

      <div className="relative space-y-4 px-5 py-4">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-[22px] border border-border/75 bg-card/95 px-4 py-3.5 shadow-tw-panel-inner"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <span className="font-heading text-sm font-semibold tracking-[-0.02em] text-foreground">
                  {row.label}
                </span>
                <p className="mt-1 text-[11px] text-muted-foreground">{row.caption}</p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums ${row.badgeClassName}`}
              >
                {row.filled}/{row.total}
              </span>
            </div>
            <Progress value={row.pct} className="h-2" indicatorClassName={row.indicatorClassName} />
            <div className="mt-1 flex justify-between">
              <span className="text-[11px] text-muted-foreground">{row.pct}%</span>
              <span className="text-[11px] text-muted-foreground">{row.gaps} remaining</span>
            </div>
          </div>
        ))}
      </div>

      <div className="relative border-t border-border/70 bg-muted/10 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-heading text-sm font-semibold text-foreground">Overall</p>
            <p className="text-[11px] text-muted-foreground">All shifts</p>
          </div>
          <div className="text-right">
            <p className="font-heading text-xl font-bold text-foreground tabular-nums">
              {overall.pct}%
            </p>
            {overall.gaps > 0 && (
              <p className="text-[11px] text-muted-foreground">{overall.gaps} gaps</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
