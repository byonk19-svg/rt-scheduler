'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type AvailabilityStatusSummaryRow = {
  therapistId: string
  therapistName: string
  overridesCount: number
  lastUpdatedAt: string | null
}

type CombinedRosterRow = AvailabilityStatusSummaryRow & {
  submitted: boolean
}

type AvailabilityStatusSummaryListProps = {
  rows: CombinedRosterRow[]
  onPickTherapist?: (therapistId: string) => void
}

function formatLastActivity(value: string | null) {
  if (!value) return 'Awaiting submission'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initialsForName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function AvailabilityStatusSummaryList({
  rows,
  onPickTherapist,
}: AvailabilityStatusSummaryListProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No therapists match the current roster filter.
      </p>
    )
  }

  return (
    <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-background/80">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span>Name</span>
        <span>Last activity</span>
      </div>

      {rows.map((row) => {
        const content = (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
                {initialsForName(row.therapistName)}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {row.therapistName}
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-5 px-1.5 text-[10px]',
                      row.submitted
                        ? 'border-[var(--success-border)] text-[var(--success-text)]'
                        : 'border-[var(--warning-border)] text-[var(--warning-text)]'
                    )}
                  >
                    {row.submitted ? 'Submitted' : 'Awaiting'}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {row.overridesCount > 0
                    ? `${row.overridesCount} request${row.overridesCount === 1 ? '' : 's'} on file`
                    : row.submitted
                      ? 'No request notes saved'
                      : 'Waiting for response'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium text-foreground">Last activity</p>
              <p className="text-[11px] text-muted-foreground">
                {formatLastActivity(row.lastUpdatedAt)}
              </p>
            </div>
          </>
        )

        if (!onPickTherapist) {
          return (
            <div
              key={row.therapistId}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2"
            >
              {content}
            </div>
          )
        }

        return (
          <button
            key={row.therapistId}
            type="button"
            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/25"
            onClick={() => onPickTherapist(row.therapistId)}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
