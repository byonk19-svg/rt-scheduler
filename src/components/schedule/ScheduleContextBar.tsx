import { CalendarDays, Clock3, Eye, Lock, Sun } from 'lucide-react'

import { cn } from '@/lib/utils'

type ScheduleContextBarProps = {
  rangeLabel: string
  cadenceLabel: string
  shiftLabel: string
  stateLabel: string
  permissionLabel: string
  className?: string
}

const itemClass =
  'flex min-w-0 items-center gap-3 rounded-md border border-border bg-background px-3 py-2'

export function ScheduleContextBar({
  rangeLabel,
  cadenceLabel,
  shiftLabel,
  stateLabel,
  permissionLabel,
  className,
}: ScheduleContextBarProps) {
  return (
    <section
      aria-label="Schedule context"
      className={cn('rounded-lg border border-border bg-card p-3 shadow-tw-sm', className)}
    >
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <div className={cn(itemClass, 'xl:col-span-2')}>
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Schedule Block
            </p>
            <p className="truncate text-sm font-bold text-foreground">{rangeLabel}</p>
          </div>
        </div>

        <div className={itemClass}>
          <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Block shape
            </p>
            <p className="truncate text-sm font-semibold text-foreground">{cadenceLabel}</p>
          </div>
        </div>

        <div className={itemClass}>
          <Sun className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Default shift
            </p>
            <p className="truncate text-sm font-semibold text-foreground">{shiftLabel}</p>
          </div>
        </div>

        <div className={itemClass}>
          <Eye className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              State
            </p>
            <p className="truncate text-sm font-semibold text-foreground">{stateLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-[var(--info-border)] bg-[var(--info-subtle)] px-3 py-2 text-xs font-semibold text-[var(--info-text)]">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        {permissionLabel}
      </div>
    </section>
  )
}
