'use client'

import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  activeFilter?: AvailabilityRosterFilter
  selectedTherapistId?: string | null
  onPickTherapist?: (therapistId: string) => void
  onFilterChange?: (filter: AvailabilityRosterFilter) => void
  onFocusMissingResponders?: () => void
  onReviewNextMissingResponder?: () => void
  nextMissingResponderName?: string | null
  embedded?: boolean
}

type CombinedRosterRow = AvailabilityStatusSummaryRow & {
  submitted: boolean
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

export function AvailabilityStatusSummary({
  submittedRows,
  missingRows,
  initialFilter = 'missing',
  activeFilter,
  selectedTherapistId,
  onPickTherapist,
  onFilterChange,
  onFocusMissingResponders,
  onReviewNextMissingResponder,
  nextMissingResponderName,
  embedded = false,
}: AvailabilityStatusSummaryProps) {
  const [uncontrolledActiveFilter, setUncontrolledActiveFilter] =
    useState<AvailabilityRosterFilter>(initialFilter)

  const resolvedActiveFilter = activeFilter ?? uncontrolledActiveFilter

  function handleFilterChange(nextFilter: AvailabilityRosterFilter) {
    if (!activeFilter) {
      setUncontrolledActiveFilter(nextFilter)
    }
    onFilterChange?.(nextFilter)
  }

  const allRows = useMemo<CombinedRosterRow[]>(
    () => [
      ...missingRows.map((row) => ({ ...row, submitted: false })),
      ...submittedRows.map((row) => ({ ...row, submitted: true })),
    ],
    [missingRows, submittedRows]
  )

  const filteredRows = useMemo(() => {
    if (resolvedActiveFilter === 'missing') return allRows.filter((row) => !row.submitted)
    if (resolvedActiveFilter === 'submitted') return allRows.filter((row) => row.submitted)
    if (resolvedActiveFilter === 'has_requests') {
      return allRows.filter((row) => row.overridesCount > 0)
    }
    return allRows.filter((row) => !row.submitted)
  }, [resolvedActiveFilter, allRows])
  const requestCount = allRows.filter((row) => row.overridesCount > 0).length

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
              resolvedActiveFilter === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            onClick={() => handleFilterChange(value)}
          >
            <span>{label}</span>
            <span className="rounded-full bg-background/75 px-1.5 py-0.5 text-[10px] text-foreground">
              {value === 'missing'
                ? missingRows.length
                : value === 'submitted'
                  ? submittedRows.length
                  : requestCount}
            </span>
          </button>
        ))}
      </div>

      {missingRows.length > 0 ? (
        <div
          className={cn(
            'border-b border-border/60 px-4 py-3',
            embedded ? 'bg-[var(--warning-subtle)]/35' : 'bg-[var(--warning-subtle)]/25'
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Not submitted</p>
                <Badge
                  variant="outline"
                  className="border-[var(--warning-border)] text-[var(--warning-text)]"
                >
                  {missingRows.length}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Focus the therapists who still need an official availability submission.
              </p>
              {nextMissingResponderName ? (
                <p className="mt-1 text-[11px] font-medium text-foreground">
                  Review next: {nextMissingResponderName}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 border-border/70 bg-background/90 text-xs text-foreground hover:bg-background"
                onClick={onFocusMissingResponders}
              >
                Focus missing responders
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-10 px-3 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={onReviewNextMissingResponder}
                disabled={!onReviewNextMissingResponder}
              >
                Review next
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={cn('overflow-y-auto px-3 py-2.5', embedded ? 'max-h-[320px]' : 'max-h-[420px]')}
      >
        {filteredRows.length > 0 ? (
          <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-background/80">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <span>Name</span>
              <span>Last activity</span>
            </div>

            {filteredRows.map((row) => {
              const isSelected = row.therapistId === selectedTherapistId
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
                        {isSelected ? (
                          <Badge className="h-5 bg-primary/10 px-1.5 text-[10px] text-primary">
                            Active in planner
                          </Badge>
                        ) : null}
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
                    aria-current={isSelected ? 'true' : undefined}
                    className={cn(
                      'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2',
                      isSelected ? 'bg-primary/[0.06]' : undefined
                    )}
                  >
                    {content}
                  </div>
                )
              }

              return (
                <button
                  key={row.therapistId}
                  type="button"
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/25',
                    isSelected ? 'bg-primary/[0.06] ring-1 ring-primary/20' : undefined
                  )}
                  onClick={() => onPickTherapist(row.therapistId)}
                >
                  {content}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No therapists match the current roster filter.
          </p>
        )}
      </div>
    </section>
  )
}
