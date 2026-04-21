'use client'

import { useMemo, useState } from 'react'

import { AvailabilityStatusSummaryList } from '@/components/availability/AvailabilityStatusSummaryList'
import { cn } from '@/lib/utils'

export type AvailabilityStatusSummaryRow = {
  therapistId: string
  therapistName: string
  overridesCount: number
  lastUpdatedAt: string | null
}

export type AvailabilityRosterFilter = 'all' | 'missing' | 'submitted' | 'has_requests'

type AvailabilityStatusSummaryProps = {
  submittedRows: AvailabilityStatusSummaryRow[]
  missingRows: AvailabilityStatusSummaryRow[]
  initialFilter?: AvailabilityRosterFilter
  onPickTherapist?: (therapistId: string) => void
  embedded?: boolean
}

type CombinedRosterRow = AvailabilityStatusSummaryRow & {
  submitted: boolean
}

export function AvailabilityStatusSummary({
  submittedRows,
  missingRows,
  initialFilter = 'missing',
  onPickTherapist,
  embedded = false,
}: AvailabilityStatusSummaryProps) {
  const [activeFilter, setActiveFilter] = useState<AvailabilityRosterFilter>(initialFilter)

  const allRows = useMemo<CombinedRosterRow[]>(
    () => [
      ...missingRows.map((row) => ({ ...row, submitted: false })),
      ...submittedRows.map((row) => ({ ...row, submitted: true })),
    ],
    [missingRows, submittedRows]
  )

  const filteredRows = useMemo(() => {
    if (activeFilter === 'all') return allRows
    if (activeFilter === 'missing') return allRows.filter((row) => !row.submitted)
    if (activeFilter === 'submitted') return allRows.filter((row) => row.submitted)
    return allRows.filter((row) => row.overridesCount > 0)
  }, [activeFilter, allRows])

  const filterCounts = {
    all: allRows.length,
    missing: missingRows.length,
    submitted: submittedRows.length,
    has_requests: allRows.filter((row) => row.overridesCount > 0).length,
  }

  return (
    <section className="flex h-full flex-col" aria-labelledby="availability-response-heading">
      {!embedded ? (
        <div className="border-b border-border/70 px-4 py-3">
          <h2
            id="availability-response-heading"
            className="text-sm font-bold tracking-[-0.01em] text-foreground"
          >
            Response roster
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow up on responses without leaving the planner.
          </p>
        </div>
      ) : null}

      <div
        className={cn(
          'flex flex-wrap gap-1 px-4 py-2',
          embedded ? 'border-b border-border/60 bg-muted/[0.04]' : 'border-b border-border/70'
        )}
      >
        {(
          [
            ['all', 'All'],
            ['missing', 'Not submitted'],
            ['submitted', 'Submitted'],
            ['has_requests', 'Has requests'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={cn(
              'inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors sm:min-h-10 sm:px-2.5 sm:py-1 sm:text-[11px]',
              activeFilter === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            onClick={() => setActiveFilter(value)}
          >
            <span>{label}</span>
            <span className="rounded-full bg-background/75 px-1.5 py-0.5 text-[10px] text-foreground">
              {filterCounts[value]}
            </span>
          </button>
        ))}
      </div>

      <div
        className={cn('overflow-y-auto px-3 py-2.5', embedded ? 'max-h-[320px]' : 'max-h-[420px]')}
      >
        <AvailabilityStatusSummaryList rows={filteredRows} onPickTherapist={onPickTherapist} />
      </div>
    </section>
  )
}
