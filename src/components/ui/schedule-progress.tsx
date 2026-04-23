'use client'

import { cn } from '@/lib/utils'

interface ProgressBarProps {
  label: string
  completed: number
  total: number
  colorClass: string
}

function ProgressBar({ label, completed, total, colorClass }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-xs font-medium text-muted-foreground">
          {completed}/{total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full origin-left rounded-full transition-transform duration-500 ease-out motion-reduce:transition-none',
            colorClass
          )}
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
      <div className="mt-1 flex justify-between">
        <span className="text-[11px] text-muted-foreground">{pct}%</span>
        <span className="text-[11px] text-muted-foreground">{total - completed} remaining</span>
      </div>
    </div>
  )
}

interface ScheduleProgressProps {
  dayScheduled?: number
  dayTotal?: number
  nightScheduled?: number
  nightTotal?: number
  totalScheduled?: number
  totalSlots?: number
  className?: string
}

export function ScheduleProgress({
  dayScheduled = 0,
  dayTotal = 0,
  nightScheduled = 0,
  nightTotal = 0,
  totalScheduled = 0,
  totalSlots = 0,
  className,
}: ScheduleProgressProps) {
  const overallPct = totalSlots > 0 ? Math.round((totalScheduled / totalSlots) * 100) : 0
  const gaps = totalSlots - totalScheduled

  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-tw-md-soft',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="font-heading text-sm font-semibold text-foreground">Schedule Completion</h3>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Current cycle
        </span>
      </div>

      <div className="flex-1 space-y-5 px-5 py-4">
        <ProgressBar
          label="Day Shifts"
          completed={dayScheduled}
          total={dayTotal}
          colorClass="bg-primary"
        />
        <ProgressBar
          label="Night Shifts"
          completed={nightScheduled}
          total={nightTotal}
          colorClass="bg-accent"
        />
      </div>

      <div className="mt-auto border-t border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Overall</p>
            <p className="text-[11px] text-muted-foreground">All shift types</p>
          </div>
          <div className="text-right">
            <p className="font-heading text-xl font-bold tabular-nums text-foreground">
              {overallPct}%
            </p>
            <p className="text-[11px] text-muted-foreground">{gaps} gaps</p>
          </div>
        </div>
      </div>
    </div>
  )
}
