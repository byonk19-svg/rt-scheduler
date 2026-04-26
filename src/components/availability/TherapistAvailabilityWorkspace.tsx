'use client'

import Link from 'next/link'
import { CalendarCheck, CalendarX2, RotateCcw, Send } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import type { AvailabilityEntryTableRow } from '@/app/availability/availability-requests-table'
import { ScheduledConflictBanner } from '@/components/availability/ScheduledConflictBanner'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { ConflictItem } from '@/lib/availability-scheduled-conflict'
import type { GeneratedAvailabilityBaselineDay } from '@/lib/availability-pattern-generator'
import { addDays, formatDateLabel, formatHumanCycleRange, toIsoDate } from '@/lib/calendar-utils'
import {
  buildTherapistSubmissionUiState,
  resolveTherapistDeadlinePresentation,
} from '@/lib/therapist-availability-submission'
import { cn } from '@/lib/utils'

type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
  availability_due_at?: string | null
}

type DayStatus = 'force_on' | 'force_off'

type Props = {
  cycles: Cycle[]
  availabilityRows: AvailabilityEntryTableRow[]
  conflicts?: ConflictItem[]
  initialCycleId: string
  recurringPatternSummary: string
  generatedBaselineByCycleId: Record<string, Record<string, GeneratedAvailabilityBaselineDay>>
  /** Official submission timestamps from therapist_availability_submissions (not inferred from overrides). */
  submissionsByCycleId: Record<string, { submittedAt: string; lastEditedAt: string }>
  submitTherapistAvailabilityGridAction: (formData: FormData) => void | Promise<void>
  returnToPath?: '/availability' | '/therapist/availability'
}

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

function monthRibbonLabel(isoDate: string, previousIsoDate: string | null): string | null {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  if (!previousIsoDate) {
    return d.toLocaleDateString('en-US', { month: 'short' })
  }
  const p = new Date(`${previousIsoDate}T12:00:00`)
  if (Number.isNaN(p.getTime())) return d.toLocaleDateString('en-US', { month: 'short' })
  if (d.getFullYear() !== p.getFullYear() || d.getMonth() !== p.getMonth()) {
    return d.toLocaleDateString('en-US', { month: 'short' })
  }
  return null
}

function buildStatusMap(rows: AvailabilityEntryTableRow[]): Record<string, DayStatus> {
  const next: Record<string, DayStatus> = {}
  for (const row of rows) {
    next[row.date] = row.entryType === 'force_off' ? 'force_off' : 'force_on'
  }
  return next
}

function buildNotesMap(rows: AvailabilityEntryTableRow[]): Record<string, string> {
  const next: Record<string, string> = {}
  for (const row of rows) {
    if (row.reason?.trim()) next[row.date] = row.reason.trim()
  }
  return next
}

function buildCycleDays(cycle: Cycle | null): string[] {
  if (!cycle) return []
  const dayCount =
    Math.floor(
      (new Date(`${cycle.end_date}T00:00:00`).getTime() -
        new Date(`${cycle.start_date}T00:00:00`).getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1
  return Array.from({ length: Math.max(dayCount, 0) }, (_, index) =>
    toIsoDate(addDays(new Date(`${cycle.start_date}T00:00:00`), index))
  )
}

function sortDateKeys(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right))
}

export function TherapistAvailabilityWorkspace({
  cycles,
  availabilityRows,
  conflicts = [],
  initialCycleId,
  recurringPatternSummary,
  generatedBaselineByCycleId,
  submissionsByCycleId,
  submitTherapistAvailabilityGridAction,
  returnToPath = '/availability',
}: Props) {
  const [selectedCycleId, setSelectedCycleId] = useState(initialCycleId || cycles[0]?.id || '')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId]
  )
  const cycleDays = useMemo(() => buildCycleDays(selectedCycle), [selectedCycle])
  const weeks = useMemo(() => {
    const result: string[][] = []
    for (let index = 0; index < cycleDays.length; index += 7)
      result.push(cycleDays.slice(index, index + 7))
    return result
  }, [cycleDays])

  const cycleRows = useMemo(
    () => availabilityRows.filter((row) => row.cycleId === selectedCycleId),
    [availabilityRows, selectedCycleId]
  )

  const initialStatusByDate = useMemo(() => buildStatusMap(cycleRows), [cycleRows])
  const initialNotesByDate = useMemo(() => buildNotesMap(cycleRows), [cycleRows])

  const [draftStatusByDate, setDraftStatusByDate] =
    useState<Record<string, DayStatus>>(initialStatusByDate)
  const [draftNotesByDate, setDraftNotesByDate] =
    useState<Record<string, string>>(initialNotesByDate)

  function handleCycleChange(nextCycleId: string) {
    setSelectedCycleId(nextCycleId)
    setSelectedDate(null)
    setRangeStart('')
    setRangeEnd('')
    const nextRows = availabilityRows.filter((row) => row.cycleId === nextCycleId)
    setDraftStatusByDate(buildStatusMap(nextRows))
    setDraftNotesByDate(buildNotesMap(nextRows))
  }

  const baselineByDate = useMemo(
    () => generatedBaselineByCycleId[selectedCycleId] ?? {},
    [generatedBaselineByCycleId, selectedCycleId]
  )

  const canWorkDates = useMemo(
    () =>
      sortDateKeys(
        Object.entries(draftStatusByDate)
          .filter(([, status]) => status === 'force_on')
          .map(([date]) => date)
      ),
    [draftStatusByDate]
  )
  const cannotWorkDates = useMemo(
    () =>
      sortDateKeys(
        Object.entries(draftStatusByDate)
          .filter(([, status]) => status === 'force_off')
          .map(([date]) => date)
      ),
    [draftStatusByDate]
  )

  const notesPayload = useMemo(
    () =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(draftNotesByDate)
            .map(([date, note]) => [date, note.trim()])
            .filter(([date, note]) => note.length > 0 && Boolean(draftStatusByDate[date]))
        )
      ),
    [draftNotesByDate, draftStatusByDate]
  )

  const baselineAvailableCount = useMemo(
    () => cycleDays.filter((date) => baselineByDate[date]?.baselineStatus === 'available').length,
    [baselineByDate, cycleDays]
  )

  const hasUnsavedChanges = useMemo(() => {
    const allStatusDates = new Set([
      ...Object.keys(initialStatusByDate),
      ...Object.keys(draftStatusByDate),
    ])
    for (const date of allStatusDates) {
      if ((initialStatusByDate[date] ?? null) !== (draftStatusByDate[date] ?? null)) return true
    }

    const allNoteDates = new Set([
      ...Object.keys(initialNotesByDate),
      ...Object.keys(draftNotesByDate),
    ])
    for (const date of allNoteDates) {
      if ((initialNotesByDate[date] ?? '').trim() !== (draftNotesByDate[date] ?? '').trim())
        return true
    }
    return false
  }, [draftNotesByDate, draftStatusByDate, initialNotesByDate, initialStatusByDate])

  const serverSubmission = submissionsByCycleId[selectedCycleId]
  const submissionUi = useMemo(
    () =>
      buildTherapistSubmissionUiState(
        serverSubmission
          ? {
              schedule_cycle_id: selectedCycleId,
              submitted_at: serverSubmission.submittedAt,
              last_edited_at: serverSubmission.lastEditedAt,
            }
          : null
      ),
    [selectedCycleId, serverSubmission]
  )

  const deadlinePresentation = useMemo(() => {
    if (!selectedCycle) return null
    return resolveTherapistDeadlinePresentation(
      {
        start_date: selectedCycle.start_date,
        availability_due_at: selectedCycle.availability_due_at ?? null,
      },
      submissionUi
    )
  }, [selectedCycle, submissionUi])

  function getBaselineStatus(date: string): 'available' | 'off' {
    return baselineByDate[date]?.baselineStatus ?? 'off'
  }

  function setOverride(date: string, status: DayStatus | null) {
    setDraftStatusByDate((current) => {
      const next = { ...current }
      if (!status) delete next[date]
      else next[date] = status
      return next
    })
    if (!status) {
      setDraftNotesByDate((current) => {
        const next = { ...current }
        delete next[date]
        return next
      })
    }
  }

  function updateSelectedDateNote(note: string) {
    if (!selectedDate) return
    setDraftNotesByDate((current) => ({
      ...current,
      [selectedDate]: note,
    }))
  }

  function getRangeDates(): string[] {
    if (!rangeStart || !rangeEnd) return []
    const ordered = [rangeStart, rangeEnd].sort((left, right) => left.localeCompare(right))
    return cycleDays.filter((date) => date >= ordered[0] && date <= ordered[1])
  }

  function applyRange(status: DayStatus | null) {
    for (const date of getRangeDates()) {
      setOverride(date, status)
    }
  }

  function clearOverrides() {
    setDraftStatusByDate({})
    setDraftNotesByDate({})
  }

  function copyPreviousCycleOverrides() {
    const cycleIndex = cycles.findIndex((cycle) => cycle.id === selectedCycleId)
    if (cycleIndex <= 0 || !selectedCycle) return

    const previousCycle = cycles[cycleIndex - 1]
    if (!previousCycle) return

    const previousDays = buildCycleDays(previousCycle)
    const previousRows = availabilityRows.filter((row) => row.cycleId === previousCycle.id)
    const nextStatus: Record<string, DayStatus> = {}
    const nextNotes: Record<string, string> = {}
    for (const row of previousRows) {
      const previousIndex = previousDays.indexOf(row.date)
      if (previousIndex < 0 || previousIndex >= cycleDays.length) continue
      const nextDate = cycleDays[previousIndex]
      nextStatus[nextDate] = row.entryType === 'force_off' ? 'force_off' : 'force_on'
      if (row.reason?.trim()) nextNotes[nextDate] = row.reason.trim()
    }
    setDraftStatusByDate(nextStatus)
    setDraftNotesByDate(nextNotes)
  }

  const cyclePageSubtitle = useMemo(() => {
    if (!selectedCycle) return 'Select a cycle to enter availability.'
    const range = `Cycle: ${formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)}`
    if (selectedCycle.published) {
      return `${range} · Published ${formatDateLabel(selectedCycle.start_date)}`
    }
    return range
  }, [selectedCycle])

  const selectedBaselineStatus = selectedDate ? getBaselineStatus(selectedDate) : 'off'
  const selectedOverride = selectedDate ? (draftStatusByDate[selectedDate] ?? null) : null

  if (cycles.length === 0) {
    return (
      <section id="therapist-availability-workspace" className="space-y-3">
        <header className="border-b border-border/70 pb-4">
          <h1 className="app-page-title">Future Availability</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            No upcoming cycle is open for availability yet.
          </p>
        </header>
      </section>
    )
  }

  return (
    <section id="therapist-availability-workspace" className="space-y-4">
      <header className="space-y-3 border-b border-border/70 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="app-page-title">Future Availability</h1>
            <p className="mt-1 text-sm text-muted-foreground">{cyclePageSubtitle}</p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Submission Status
            </p>
            <span
              className={cn(
                'mt-1 inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-semibold',
                submissionUi.isSubmitted
                  ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
                  : 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
              )}
            >
              {submissionUi.isSubmitted ? 'Submitted' : 'Not submitted'}
            </span>
            {deadlinePresentation?.deadlineHeadline && !submissionUi.isSubmitted ? (
              <p
                className={cn(
                  'mt-1 text-xs font-medium',
                  deadlinePresentation.emphasis === 'past' && 'text-[var(--error-text)]',
                  deadlinePresentation.emphasis === 'urgent' && 'text-[var(--warning-text)]',
                  deadlinePresentation.emphasis === 'neutral' && 'text-muted-foreground'
                )}
              >
                {deadlinePresentation.deadlineHeadline}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/[0.08] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Based on your recurring pattern
              </p>
              <p className="text-sm font-semibold text-foreground">{recurringPatternSummary}</p>
              <p className="text-sm text-muted-foreground">
                Changes here apply to this cycle only.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/therapist/recurring-pattern">Change recurring pattern</Link>
            </Button>
          </div>
        </div>

        <p className="text-xs tabular-nums text-muted-foreground">
          Availability summary: {baselineAvailableCount} baseline available ·{' '}
          {cannotWorkDates.length} need off · {canWorkDates.length} request to work
        </p>
        {hasUnsavedChanges ? (
          <p className="text-xs font-medium text-[var(--warning-text)]">
            You have unsaved changes for this cycle.
          </p>
        ) : null}
      </header>

      {conflicts.length > 0 ? (
        <ScheduledConflictBanner conflicts={conflicts} onDismiss={() => {}} />
      ) : null}

      <form
        action={submitTherapistAvailabilityGridAction}
        className="overflow-hidden rounded-[20px] border border-border/80 bg-card shadow-tw-2xs-soft"
      >
        <input type="hidden" name="cycle_id" value={selectedCycleId} />
        <input type="hidden" name="return_to" value={returnToPath} />
        <input type="hidden" name="notes_json" value={notesPayload} />
        {canWorkDates.map((date) => (
          <input key={`can-${date}`} type="hidden" name="can_work_dates" value={date} />
        ))}
        {cannotWorkDates.map((date) => (
          <input key={`cannot-${date}`} type="hidden" name="cannot_work_dates" value={date} />
        ))}

        <div className="border-b border-border/80 px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-full max-w-[17rem] space-y-1">
              <Label
                htmlFor="therapist_cycle_id"
                className="text-[0.6rem] font-medium uppercase tracking-[0.08em] text-muted-foreground/75"
              >
                Cycle
              </Label>
              <select
                id="therapist_cycle_id"
                value={selectedCycleId}
                onChange={(event) => handleCycleChange(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {formatHumanCycleRange(cycle.start_date, cycle.end_date)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={clearOverrides}>
                Clear overrides
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearOverrides}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden />
                Reapply pattern
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyPreviousCycleOverrides}
              >
                Copy previous cycle
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 divide-y divide-border/80 xl:grid-cols-[minmax(0,1fr)_20rem] xl:divide-x xl:divide-y-0">
          <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
            <div className="rounded-2xl border border-border/70 bg-muted/[0.05] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Generated from your recurring pattern
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review the generated cycle, then add overrides only where this cycle differs.
                  </p>
                </div>
                <div className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
                  This cycle only
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1">
                  <Label htmlFor="range-start">Range start</Label>
                  <input
                    id="range-start"
                    type="date"
                    min={selectedCycle?.start_date}
                    max={selectedCycle?.end_date}
                    value={rangeStart}
                    onChange={(event) => setRangeStart(event.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="range-end">Range end</Label>
                  <input
                    id="range-end"
                    type="date"
                    min={selectedCycle?.start_date}
                    max={selectedCycle?.end_date}
                    value={rangeEnd}
                    onChange={(event) => setRangeEnd(event.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyRange('force_off')}
                  >
                    Mark range unavailable
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyRange('force_on')}
                  >
                    Request range to work
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => applyRange(null)}>
                    Clear range
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 border-y border-border/70 py-2">
              {DOW.map((dow) => (
                <p
                  key={dow}
                  className="text-center text-[0.68rem] font-semibold tracking-[0.1em] text-muted-foreground"
                >
                  {dow}
                </p>
              ))}
            </div>

            <div className="space-y-4">
              {weeks.map((week, weekIndex) => (
                <div key={`week-${weekIndex}`} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                      Week {weekIndex + 1}
                    </p>
                    <div className="h-px flex-1 bg-border/80" />
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {week.map((date) => {
                      const baselineStatus = getBaselineStatus(date)
                      const overrideStatus = draftStatusByDate[date] ?? null
                      const dayIndex = cycleDays.indexOf(date)
                      const monthRibbon = monthRibbonLabel(
                        date,
                        dayIndex > 0 ? cycleDays[dayIndex - 1] : null
                      )
                      const dayNum = new Date(`${date}T00:00:00`).getDate()

                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => {
                            setSelectedDate(date)
                            requestAnimationFrame(() => noteTextareaRef.current?.focus())
                          }}
                          className={cn(
                            'relative flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center',
                            baselineStatus === 'available' &&
                              !overrideStatus &&
                              'border-[var(--success-border)]/50 bg-[var(--success-subtle)]/45',
                            baselineStatus === 'off' &&
                              !overrideStatus &&
                              'border-border/40 bg-muted/15',
                            overrideStatus === 'force_off' &&
                              'border-[var(--error-border)] bg-[var(--error-subtle)]',
                            overrideStatus === 'force_on' &&
                              'border-[var(--info-border)] bg-[var(--info-subtle)]',
                            selectedDate === date &&
                              'ring-2 ring-primary/60 ring-offset-1 ring-offset-card'
                          )}
                          aria-label={formatDateLabel(date)}
                        >
                          {monthRibbon ? (
                            <span className="text-[0.5rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
                              {monthRibbon}
                            </span>
                          ) : (
                            <span className="h-[0.5rem]" aria-hidden />
                          )}
                          <span className="text-[1.15rem] font-bold text-foreground">{dayNum}</span>
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-px text-[0.5rem] font-semibold uppercase tracking-[0.05em]',
                              overrideStatus === 'force_off' &&
                                'bg-[var(--error-subtle)] text-[var(--error-text)] ring-1 ring-[var(--error-border)]/60',
                              overrideStatus === 'force_on' &&
                                'bg-[var(--info-subtle)] text-[var(--info-text)] ring-1 ring-[var(--info-border)]/60',
                              !overrideStatus &&
                                baselineStatus === 'available' &&
                                'bg-[var(--success-subtle)] text-[var(--success-text)]',
                              !overrideStatus &&
                                baselineStatus === 'off' &&
                                'bg-[var(--muted)] text-[var(--muted-foreground)]'
                            )}
                          >
                            {overrideStatus === 'force_off'
                              ? 'Need Off'
                              : overrideStatus === 'force_on'
                                ? 'Request'
                                : baselineStatus === 'available'
                                  ? 'Available'
                                  : 'Off'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6 px-4 py-5">
            <div>
              <h3 className="mb-2.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Legend
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--success-text)]" />
                  <span className="text-xs text-muted-foreground">
                    Generated from your recurring pattern
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--error-text)]" />
                  <span className="text-xs text-muted-foreground">Need Off override</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--info-text)]" />
                  <span className="text-xs text-muted-foreground">Request to Work override</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    This cycle only
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Day Notes
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add optional details to any cycle-specific override.
                </p>
              </div>

              <div>
                <h3 className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Selected day
                </h3>
                {!selectedDate ? (
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    Select a date to review the generated baseline and add an override in the panel
                    on the right.
                  </p>
                ) : (
                  <div className="mt-2 space-y-3 rounded-xl border border-border/70 bg-muted/10 px-3 py-3">
                    <p className="text-sm font-semibold text-foreground">
                      {formatDateLabel(selectedDate)}
                    </p>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Baseline
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedBaselineStatus === 'available'
                          ? 'Available from your recurring pattern'
                          : 'Off in your recurring pattern'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedBaselineStatus === 'available' ? (
                        <Button
                          type="button"
                          variant={selectedOverride === 'force_off' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() =>
                            setOverride(
                              selectedDate,
                              selectedOverride === 'force_off' ? null : 'force_off'
                            )
                          }
                        >
                          <CalendarX2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                          Need off this day
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant={selectedOverride === 'force_on' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() =>
                            setOverride(
                              selectedDate,
                              selectedOverride === 'force_on' ? null : 'force_on'
                            )
                          }
                        >
                          <CalendarCheck className="mr-1 h-3.5 w-3.5" aria-hidden />
                          Request to work this day
                        </Button>
                      )}
                      {selectedOverride ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setOverride(selectedDate, null)}
                        >
                          Clear override
                        </Button>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`therapist-day-note-${selectedDate}`}>Day Notes</Label>
                      {/* Persisted notes only exist for Need Off or Request to Work days. */}
                      <textarea
                        id={`therapist-day-note-${selectedDate}`}
                        ref={noteTextareaRef}
                        value={draftNotesByDate[selectedDate] ?? ''}
                        onChange={(event) => updateSelectedDateNote(event.target.value)}
                        placeholder="Add a note for this override..."
                        disabled={!selectedOverride}
                        className="min-h-[84px] w-full rounded-lg border border-border/15 bg-background px-2.5 py-1.5 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      {!selectedOverride ? (
                        <p className="text-xs text-muted-foreground">
                          Notes are only saved for Need Off or Request to Work days.
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/70 bg-muted/10 px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <p className="text-xs text-muted-foreground sm:mr-auto">
            Save progress keeps a draft. Submit availability marks this cycle as officially
            submitted.
          </p>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
            {!submissionUi.isSubmitted ? (
              <>
                <FormSubmitButton
                  type="submit"
                  name="workflow"
                  value="draft"
                  variant="outline"
                  size="sm"
                  pendingText="Saving..."
                  className="min-h-11 shrink-0 px-4 font-semibold sm:min-w-[8.5rem]"
                >
                  Save progress
                </FormSubmitButton>
                <FormSubmitButton
                  type="submit"
                  name="workflow"
                  value="submit"
                  size="sm"
                  pendingText="Saving..."
                  className="min-h-11 shrink-0 gap-2 px-5 font-semibold shadow-sm sm:min-w-[10.5rem]"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  Submit availability
                </FormSubmitButton>
              </>
            ) : (
              <FormSubmitButton
                type="submit"
                name="workflow"
                value="submit"
                size="sm"
                pendingText="Saving..."
                className="min-h-11 shrink-0 gap-2 px-5 font-semibold shadow-sm"
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                Save changes
              </FormSubmitButton>
            )}
          </div>
        </div>
      </form>
    </section>
  )
}
