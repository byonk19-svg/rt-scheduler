'use client'

import { useMemo, useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { FeedbackToast } from '@/components/feedback-toast'
import { cn } from '@/lib/utils'

export type AvailabilityStatusSummaryRow = {
  therapistId: string
  therapistName: string
  overridesCount: number
  lastUpdatedAt: string | null
  shiftType?: 'day' | 'night'
  employmentType?: 'full_time' | 'part_time' | 'prn'
}

export type AvailabilityRosterFilter = 'all' | 'missing' | 'submitted' | 'has_requests'

type AvailabilityStatusSummaryProps = {
  submittedRows: AvailabilityStatusSummaryRow[]
  missingRows: AvailabilityStatusSummaryRow[]
  initialFilter?: AvailabilityRosterFilter
  activeFilter?: AvailabilityRosterFilter
  selectedTherapistId?: string | null
  onPickTherapist?: (therapistId: string) => void
  onReviewTherapist?: (therapistId: string) => void
  onFilterChange?: (filter: AvailabilityRosterFilter) => void
  embedded?: boolean
  searchTerm?: string
  activeShift?: 'day' | 'night'
  cycleId?: string
  onSendReminders?: () => Promise<{ sent: number; skipped: number; failed: number; error?: string }>
}

type CombinedRosterRow = AvailabilityStatusSummaryRow & {
  submitted: boolean
  shiftType: 'day' | 'night'
  employmentType: 'full_time' | 'part_time' | 'prn'
}

function formatLastActivity(value: string | null) {
  if (!value) return 'No activity yet'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function employmentLabel(value: CombinedRosterRow['employmentType']) {
  if (value === 'part_time') return 'Part-time'
  if (value === 'prn') return 'PRN'
  return 'Full-time'
}

function shiftLabel(value: CombinedRosterRow['shiftType']) {
  return value === 'night' ? 'Night shift' : 'Day shift'
}

function initialsForName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function statusBadgeClass(submitted: boolean) {
  return submitted
    ? 'border-[var(--success-border)] text-[var(--success-text)]'
    : 'border-[var(--warning-border)] text-[var(--warning-text)]'
}

export function AvailabilityStatusSummary({
  submittedRows,
  missingRows,
  initialFilter = 'missing',
  activeFilter,
  selectedTherapistId,
  onPickTherapist,
  onReviewTherapist,
  onFilterChange,
  embedded = false,
  searchTerm = '',
  activeShift,
  onSendReminders,
}: AvailabilityStatusSummaryProps) {
  const [uncontrolledActiveFilter, setUncontrolledActiveFilter] =
    useState<AvailabilityRosterFilter>(initialFilter)
  const [visibleCount, setVisibleCount] = useState(5)
  const [isSending, setIsSending] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)

  const resolvedActiveFilter = activeFilter ?? uncontrolledActiveFilter

  async function handleSendReminders() {
    if (!onSendReminders) return
    setIsSending(true)
    setToast(null)
    try {
      const result = await onSendReminders()
      if (result.error === 'email_not_configured') {
        setToast({
          message: 'Failed to send reminders — check email configuration',
          variant: 'error',
        })
      } else if (result.error) {
        setToast({ message: 'Failed to send reminders', variant: 'error' })
      } else if (result.sent === 0 && result.skipped === 0 && result.failed === 0) {
        setToast({ message: 'Everyone has already submitted', variant: 'success' })
      } else if (result.sent === 0 && result.skipped > 0) {
        setToast({
          message: 'No reminders sent — all missing therapists have email notifications disabled',
          variant: 'error',
        })
      } else {
        const parts: string[] = [
          `Reminders sent to ${result.sent} therapist${result.sent === 1 ? '' : 's'}`,
        ]
        if (result.skipped > 0) parts.push(`${result.skipped} skipped — email disabled`)
        if (result.failed > 0) parts.push(`${result.failed} failed`)
        setToast({ message: parts.join(' · '), variant: result.failed > 0 ? 'error' : 'success' })
      }
    } finally {
      setIsSending(false)
    }
  }

  function handleFilterChange(nextFilter: AvailabilityRosterFilter) {
    if (!activeFilter) {
      setUncontrolledActiveFilter(nextFilter)
    }
    onFilterChange?.(nextFilter)
  }

  const allRows = useMemo<CombinedRosterRow[]>(
    () =>
      [
        ...missingRows.map((row) => ({
          ...row,
          submitted: false,
          shiftType: row.shiftType ?? 'day',
          employmentType: row.employmentType ?? 'full_time',
        })),
        ...submittedRows.map((row) => ({
          ...row,
          submitted: true,
          shiftType: row.shiftType ?? 'day',
          employmentType: row.employmentType ?? 'full_time',
        })),
      ].sort((a, b) => {
        if (a.submitted !== b.submitted) return a.submitted ? 1 : -1
        if (a.overridesCount !== b.overridesCount) return b.overridesCount - a.overridesCount
        return a.therapistName.localeCompare(b.therapistName)
      }),
    [missingRows, submittedRows]
  )

  const visibleRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return allRows.filter((row) => {
      if (activeShift && row.shiftType !== activeShift) return false
      if (!normalizedSearch) return true
      const haystack = `${row.therapistName} ${row.shiftType} ${row.employmentType}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [activeShift, allRows, searchTerm])

  const filteredRows = useMemo(() => {
    if (resolvedActiveFilter === 'missing') return visibleRows.filter((row) => !row.submitted)
    if (resolvedActiveFilter === 'submitted') return visibleRows.filter((row) => row.submitted)
    if (resolvedActiveFilter === 'has_requests') {
      return visibleRows.filter((row) => row.overridesCount > 0)
    }
    return visibleRows
  }, [resolvedActiveFilter, visibleRows])

  const requestCount = visibleRows.filter((row) => row.overridesCount > 0).length
  const missingCount = visibleRows.filter((row) => !row.submitted).length
  const submittedCount = visibleRows.filter((row) => row.submitted).length
  const displayedRows = filteredRows.slice(0, visibleCount)
  const canLoadMore = filteredRows.length > visibleCount

  return (
    <section
      aria-labelledby="availability-work-queue-heading"
      className="flex min-h-0 flex-col overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-tw-sm"
    >
      <div
        className={cn(
          'flex flex-wrap gap-6 border-b border-border/60 px-4 py-5',
          embedded ? 'bg-muted/[0.04]' : undefined
        )}
      >
        {(
          [
            ['missing', 'Needs attention', missingCount],
            ['has_requests', 'Has requests', requestCount],
            ['submitted', 'Submitted', submittedCount],
            ['all', 'All', visibleRows.length],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            data-roster-filter={value}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent px-1 py-2 text-[1.05rem] font-medium tracking-[-0.02em] transition-colors',
              resolvedActiveFilter === value
                ? 'border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => handleFilterChange(value)}
          >
            <span>{label}</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px]',
                resolvedActiveFilter === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {count}
            </span>
          </button>
        ))}

        {onSendReminders && missingRows.length > 0 ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={isSending}
                className="ml-auto inline-flex min-h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                data-testid="send-reminders-trigger"
              >
                {isSending ? (
                  <span aria-live="polite">Sending…</span>
                ) : (
                  <>Send reminders ({missingRows.length})</>
                )}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send availability reminders?</AlertDialogTitle>
                <AlertDialogDescription>
                  {missingRows.length} therapist{missingRows.length === 1 ? '' : 's'}{' '}
                  {missingRows.length === 1 ? "hasn't" : "haven't"} submitted yet. They'll receive
                  an email with a link to submit their availability.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSendReminders}>Send reminders</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      <div className="px-3 py-3">
        {displayedRows.length > 0 ? (
          <div className="space-y-2">
            <div className="hidden grid-cols-[minmax(0,2.9fr)_6rem_3.25rem_5.75rem_5.75rem] gap-4 px-2 pb-2 text-[13px] font-medium text-muted-foreground md:grid">
              <span>Therapist</span>
              <span>Status</span>
              <span>Requests</span>
              <span>Last activity</span>
              <span>Actions</span>
            </div>
            {displayedRows.map((row) => {
              const isSelected = row.therapistId === selectedTherapistId
              return (
                <div
                  key={row.therapistId}
                  aria-current={isSelected ? 'true' : undefined}
                  data-therapist-row={row.therapistId}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'rounded-[1.1rem] border px-4 py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    isSelected
                      ? 'border-primary/35 bg-[color:rgba(15,118,110,0.045)] shadow-tw-inset-highlight-soft'
                      : 'border-border/60 bg-background/85 hover:border-border'
                  )}
                  onClick={() => onPickTherapist?.(row.therapistId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onPickTherapist?.(row.therapistId)
                    }
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-[minmax(0,2.9fr)_6rem_3.25rem_5.75rem_5.75rem] md:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/55 text-base font-semibold text-foreground">
                        {initialsForName(row.therapistName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[1.02rem] font-semibold tracking-[-0.02em] text-foreground">
                          {row.therapistName}
                        </p>

                        <p className="mt-1 text-[12px] text-muted-foreground">
                          {shiftLabel(row.shiftType)} · {employmentLabel(row.employmentType)}
                        </p>
                      </div>
                    </div>

                    <div className="md:text-center">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center rounded-md border bg-secondary px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                          statusBadgeClass(row.submitted)
                        )}
                      >
                        {row.submitted ? 'Submitted' : 'Not submitted'}
                      </span>
                    </div>

                    <div className="text-base font-semibold text-foreground md:text-center">
                      {row.overridesCount}
                    </div>

                    <div className="whitespace-nowrap text-[12px] text-muted-foreground md:text-center">
                      {formatLastActivity(row.lastUpdatedAt)}
                    </div>

                    <div className="flex md:justify-end">
                      <button
                        type="button"
                        data-review-action={row.therapistId}
                        className="inline-flex min-h-9 w-[96px] items-center justify-center rounded-full border border-border bg-card px-3 text-[11px] font-medium text-foreground transition-all duration-150 hover:bg-secondary/70 hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation()
                          onReviewTherapist?.(row.therapistId)
                        }}
                      >
                        Review
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
            No therapists match the current work queue view.
          </div>
        )}

        {canLoadMore ? (
          <div className="mt-4 flex justify-center border-t border-border/60 pt-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              onClick={() => setVisibleCount((count) => count + 5)}
            >
              <span aria-hidden="true">v</span>
              Load more
            </button>
          </div>
        ) : null}
      </div>

      {toast ? <FeedbackToast message={toast.message} variant={toast.variant} /> : null}
    </section>
  )
}
