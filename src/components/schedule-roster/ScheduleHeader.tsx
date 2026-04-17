import { Badge } from '@/components/ui/badge'

type ScheduleHeaderProps = {
  title: string
  status: string
  dateRange: string
  helperText: string
}

export function ScheduleHeader({ title, status, dateRange, helperText }: ScheduleHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-[2.2rem]">
          {title}
        </h1>
        <Badge
          variant="outline"
          className="rounded-full border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[var(--warning-text)]"
        >
          {status}
        </Badge>
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">{dateRange}</p>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{helperText}</p>
      </div>
    </div>
  )
}
