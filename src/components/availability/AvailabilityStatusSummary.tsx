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

export type AvailabilityRosterFilter =
  | 'all'
  | 'missing'
  | 'submitted_with_exceptions'
  | 'submitted_no_exceptions'
  | 'submitted'
  | 'has_requests'

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

function queueStatusLabel(row: CombinedRosterRow) {
  if (!row.submitted) return 'Needs submission'
  return row.overridesCount > 0 ? 'Submitted with requests' : 'Submitted no requests'
}

function reminderButtonLabel(activeFilter: AvailabilityRosterFilter, missingCount: number) {
  const count = `(${missingCount})`
  return activeFilter === 'missing'
    ? `Remind missing submissions ${count}`
    : `Send reminders ${count}`
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
      return visibleRows.filter((row) => row.submitted && row.overridesCount > 0)
    }
    if (resolvedActiveFilter === 'submitted_with_exceptions') {
      return visibleRows.filter((row) => row.submitted && row.overridesCount > 0)
    }
    if (resolvedActiveFilter === 'submitted_no_exceptions') {
      return visibleRows.filter((row) => row.submitted && row.overridesCount === 0)
    }
    return visibleRows
  }, [resolvedActiveFilter, visibleRows])

  const missingCount = visibleRows.filter((row) => !row.submitted).length
  const submittedWithExceptionsCount = visibleRows.filter(
    (row) => row.submitted && row.overridesCount > 0
  ).length
  const submittedNoExceptionsCount = visibleRows.filter(
    (row) => row.submitted && row.overridesCount === 0
  ).length
  const displayedRows = filteredRows.slice(0, visibleCount)
  const canLoadMore = filteredRows.length > visibleCount

  return (
    <section
      aria-labelledby="availability-work-queue-heading"
      className="flex min-h-0 flex-col overflow-hidden rounded-[1.25rem] border border-border/70 bg-card shadow-tw-sm"
    >
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-4',
          embedded ? 'bg-muted/[0.04]' : undefined
        )}
      >
        <div className="mr-auto min-w-[13rem]">
          <h2 id="availability-work-queue-heading" className="text-base font-bold text-foreground">
            Availability queue
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Follow up on missing submissions and review therapist requests.
          </p>
        </div>
        {(
          [
            ['missing', 'Needs submission', missingCount],
            ['submitted_with_exceptions', 'Submitted with requests', submittedWithExceptionsCount],
            ['submitted_no_exceptions', 'Submitted no requests', submittedNoExceptionsCount],
            ['all', 'All therapists', visibleRows.length],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            data-roster-filter={value}
            className={cn(
              'inline-flex min-h-9 items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm font-semibold transition-colors',
              resolvedActiveFilter === value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            )}
            onClick={() => handleFilterChange(value)}
          >
            <span>{label}</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px]',
                resolvedActiveFilter === value
                  ? 'bg-primary-foreground/20 text-primary-foreground'
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
                className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                data-testid="send-reminders-trigger"
              >
                {isSending ? (
                  <span aria-live="polite">Sending…</span>
                ) : (
                  <>{reminderButtonLabel(resolvedActiveFilter, missingRows.length)}</>
                )}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send availability reminders?</AlertDialogTitle>
                <AlertDialogDescription>
                  {missingRows.length} therapist{missingRows.length === 1 ? '' : 's'}{' '}
                  {missingRows.length === 1 ? "hasn't" : "haven't"} submitted yet. They&apos;ll
                  receive an email with a link to submit their availability.
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
            <div className="hidden items-center justify-between gap-3 px-2 pb-2 text-[12px] font-medium text-muted-foreground md:flex">
              <span>Therapist</span>
              <span>Status / requests / activity</span>
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
                    'rounded-[0.9rem] border px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
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
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="flex min-w-0 flex-1 basis-full items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/55 text-sm font-semibold text-foreground">
                        {initialsForName(row.therapistName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold leading-5 text-foreground">
                          {row.therapistName}
                        </p>

                        <p className="mt-1 truncate text-[12px] text-muted-foreground">
                          {shiftLabel(row.shiftType)} {'\u00b7'}{' '}
                          {employmentLabel(row.employmentType)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <span
                        className={cn(
                          'inline-flex items-center justify-center rounded-md border bg-secondary px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                          statusBadgeClass(row.submitted)
                        )}
                      >
                        {queueStatusLabel(row)}
                      </span>
                    </div>

                    <div className="text-[12px] font-medium text-muted-foreground">
                      Requests: {row.overridesCount}
                    </div>

                    <div className="whitespace-nowrap text-[12px] text-muted-foreground">
                      {formatLastActivity(row.lastUpdatedAt)}
                    </div>

                    <div className="ml-auto flex">
                      <button
                        type="button"
                        data-review-action={row.therapistId}
                        className="inline-flex min-h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-[11px] font-medium text-foreground transition-all duration-150 hover:bg-secondary/70 hover:text-foreground"
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
