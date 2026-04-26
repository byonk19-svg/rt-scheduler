'use client'

import { CalendarCheck, CalendarX2, Send } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { AvailabilityEntryTableRow } from '@/app/availability/availability-requests-table'
import { ScheduledConflictBanner } from '@/components/availability/ScheduledConflictBanner'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Label } from '@/components/ui/label'
import type { ConflictItem } from '@/lib/availability-scheduled-conflict'
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

type Props = {
  cycles: Cycle[]
  availabilityRows: AvailabilityEntryTableRow[]
  conflicts?: ConflictItem[]
  initialCycleId: string
  /** Official submission timestamps from therapist_availability_submissions (not inferred from overrides). */
  submissionsByCycleId: Record<string, { submittedAt: string; lastEditedAt: string }>
  submitTherapistAvailabilityGridAction: (formData: FormData) => void | Promise<void>
  returnToPath?: '/availability' | '/therapist/availability'
}

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
type DayStatus = 'none' | 'force_on' | 'force_off'

function therapistDayStatusLabel(status: DayStatus): string {
  if (status === 'force_off') return 'Need Off'
  if (status === 'force_on') return 'Request to Work'
  return 'Available'
}

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

export function TherapistAvailabilityWorkspace({
  cycles,
  availabilityRows,
  conflicts = [],
  initialCycleId,
  submissionsByCycleId,
  submitTherapistAvailabilityGridAction,
  returnToPath = '/availability',
}: Props) {
  const [selectedCycleId, setSelectedCycleId] = useState(initialCycleId || cycles[0]?.id || '')

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId]
  )

  const cycleRows = useMemo(
    () => availabilityRows.filter((row) => row.cycleId === selectedCycleId),
    [availabilityRows, selectedCycleId]
  )

  const initialStatusByDate = useMemo(() => {
    const next: Record<string, DayStatus> = {}
    for (const row of cycleRows) {
      next[row.date] = row.entryType === 'force_off' ? 'force_off' : 'force_on'
    }
    return next
  }, [cycleRows])

  const initialNotesByDate = useMemo(() => {
    const next: Record<string, string> = {}
    for (const row of cycleRows) {
      if (row.reason?.trim()) next[row.date] = row.reason.trim()
    }
    return next
  }, [cycleRows])

  const [draftStatusByDate, setDraftStatusByDate] =
    useState<Record<string, DayStatus>>(initialStatusByDate)
  const [draftNotesByDate, setDraftNotesByDate] =
    useState<Record<string, string>>(initialNotesByDate)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)

  function handleCycleChange(nextCycleId: string) {
    setSelectedCycleId(nextCycleId)
    setSelectedDate(null)
    const nextRows = availabilityRows.filter((row) => row.cycleId === nextCycleId)
    const nextStatusByDate: Record<string, DayStatus> = {}
    const nextNotesByDate: Record<string, string> = {}
    for (const row of nextRows) {
      nextStatusByDate[row.date] = row.entryType === 'force_off' ? 'force_off' : 'force_on'
      if (row.reason?.trim()) nextNotesByDate[row.date] = row.reason.trim()
    }
    setDraftStatusByDate(nextStatusByDate)
    setDraftNotesByDate(nextNotesByDate)
  }

  const cycleDays = useMemo(() => {
    if (!selectedCycle) return [] as string[]
    const dayCount =
      Math.floor(
        (new Date(`${selectedCycle.end_date}T00:00:00`).getTime() -
          new Date(`${selectedCycle.start_date}T00:00:00`).getTime()) /
          (24 * 60 * 60 * 1000)
      ) + 1
    return Array.from({ length: Math.max(dayCount, 0) }, (_, i) =>
      toIsoDate(addDays(new Date(`${selectedCycle.start_date}T00:00:00`), i))
    )
  }, [selectedCycle])

  const weeks = useMemo(() => {
    const result: string[][] = []
    for (let i = 0; i < cycleDays.length; i += 7) result.push(cycleDays.slice(i, i + 7))
    return result
  }, [cycleDays])

  const canWorkDates = useMemo(
    () =>
      Object.entries(draftStatusByDate)
        .filter(([, status]) => status === 'force_on')
        .map(([date]) => date)
        .sort((a, b) => a.localeCompare(b)),
    [draftStatusByDate]
  )
  const cannotWorkDates = useMemo(
    () =>
      Object.entries(draftStatusByDate)
        .filter(([, status]) => status === 'force_off')
        .map(([date]) => date)
        .sort((a, b) => a.localeCompare(b)),
    [draftStatusByDate]
  )

  /** Persisted notes only exist for Need Off / Request to Work; omit Available-only drafts. */
  const daysWithNoteText = useMemo(
    () =>
      cycleDays.filter((date) => {
        const status = draftStatusByDate[date] ?? 'none'
        if (status !== 'force_off' && status !== 'force_on') return false
        return (draftNotesByDate[date] ?? '').trim().length > 0
      }),
    [cycleDays, draftNotesByDate, draftStatusByDate]
  )

  const notesPayload = useMemo(
    () =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(draftNotesByDate)
            .map(([date, note]) => [date, note.trim()])
            .filter(([date, note]) => {
              if (note.length === 0) return false
              const s = draftStatusByDate[date] ?? 'none'
              return s === 'force_on' || s === 'force_off'
            })
        )
      ),
    [draftNotesByDate, draftStatusByDate]
  )

  const availableCount = useMemo(() => {
    if (!selectedCycle) return 0
    return cycleDays.filter((date) => (draftStatusByDate[date] ?? 'none') === 'none').length
  }, [cycleDays, draftStatusByDate, selectedCycle])

  const requestToWorkCount = canWorkDates.length

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

  const hasUnsavedChanges = useMemo(() => {
    const allDates = new Set([
      ...Object.keys(initialStatusByDate),
      ...Object.keys(draftStatusByDate),
    ])
    for (const date of allDates) {
      if ((initialStatusByDate[date] ?? 'none') !== (draftStatusByDate[date] ?? 'none')) {
        return true
      }
    }
    const allNoteDates = new Set([
      ...Object.keys(initialNotesByDate),
      ...Object.keys(draftNotesByDate),
    ])
    for (const date of allNoteDates) {
      if ((initialNotesByDate[date] ?? '').trim() !== (draftNotesByDate[date] ?? '').trim()) {
        return true
      }
    }
    return false
  }, [draftNotesByDate, draftStatusByDate, initialNotesByDate, initialStatusByDate])

  const submissionPrimaryLabel = submissionUi.isSubmitted ? 'Submitted' : 'Not submitted'

  const cyclePageSubtitle = useMemo(() => {
    if (!selectedCycle) return 'Select a cycle to enter availability.'
    const range = `Cycle: ${formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)}`
    if (selectedCycle.published) {
      return `${range} · Published ${formatDateLabel(selectedCycle.start_date)}`
    }
    return range
  }, [selectedCycle])

  const selectedDayStatus = selectedDate
    ? (draftStatusByDate[selectedDate] ?? 'none')
    : ('none' as DayStatus)

  const selectedDayNeedsClear = Boolean(
    selectedDate &&
    ((draftStatusByDate[selectedDate] ?? 'none') !== 'none' ||
      (draftNotesByDate[selectedDate] ?? '').trim().length > 0)
  )

  useEffect(() => {
    if (!selectedDate) return
    if (selectedDayStatus !== 'force_off' && selectedDayStatus !== 'force_on') return
    const id = requestAnimationFrame(() => {
      noteTextareaRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [selectedDate, selectedDayStatus])

  function toggleDate(date: string) {
    if (!selectedCycle) return
    setDraftStatusByDate((current) => {
      const status = current[date] ?? 'none'
      const next: DayStatus =
        status === 'none' ? 'force_off' : status === 'force_off' ? 'force_on' : 'none'
      const prev = { ...current }
      if (next === 'none') {
        delete prev[date]
        setDraftNotesByDate((currentNotes) => {
          const nextNotes = { ...currentNotes }
          delete nextNotes[date]
          return nextNotes
        })
        return prev
      }
      return { ...prev, [date]: next }
    })
  }

  function updateDateNote(date: string, note: string) {
    setDraftNotesByDate((current) => ({
      ...current,
      [date]: note,
    }))
  }

  function handleDayClick(date: string) {
    setSelectedDate(date)
    toggleDate(date)
  }

  function clearSelectedDay() {
    if (!selectedDate) return
    const date = selectedDate
    setDraftStatusByDate((current) => {
      const next = { ...current }
      delete next[date]
      return next
    })
    setDraftNotesByDate((currentNotes) => {
      const next = { ...currentNotes }
      delete next[date]
      return next
    })
  }

  const actionButtons = (
    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
      {!submissionUi.isSubmitted ? (
        <>
          <FormSubmitButton
            type="submit"
            name="workflow"
            value="draft"
            variant="outline"
            size="sm"
            pendingText="Saving…"
            className="min-h-11 shrink-0 px-4 font-semibold sm:min-w-[8.5rem]"
          >
            Save progress
          </FormSubmitButton>
          <FormSubmitButton
            type="submit"
            name="workflow"
            value="submit"
            size="sm"
            pendingText="Saving…"
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
          pendingText="Saving…"
          className="min-h-11 shrink-0 gap-2 px-5 font-semibold shadow-sm"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          Save changes
        </FormSubmitButton>
      )}
    </div>
  )

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
      {/* ── Header ─────────────────────────────────── */}
      <header className="border-b border-border/70 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="app-page-title">Future Availability</h1>
            <p className="mt-1 text-sm text-muted-foreground">{cyclePageSubtitle}</p>
          </div>

          {/* Submission status badge — top right */}
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
              {submissionPrimaryLabel}
            </span>
            {deadlinePresentation &&
            !submissionUi.isSubmitted &&
            deadlinePresentation.deadlineHeadline ? (
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
            {deadlinePresentation &&
            submissionUi.isSubmitted &&
            deadlinePresentation.submittedPrimaryLine ? (
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {deadlinePresentation.submittedPrimaryLine}
              </p>
            ) : null}
          </div>
        </div>

        {submissionUi.isSubmitted && hasUnsavedChanges ? (
          <p className="mt-2 text-xs font-medium text-[var(--warning-text)]">
            You have unsaved changes — save to update your submitted availability.
          </p>
        ) : null}
        {!submissionUi.isSubmitted && hasUnsavedChanges ? (
          <p className="mt-2 text-xs font-medium text-[var(--warning-text)]">
            You have unsaved changes. Save progress or submit availability.
          </p>
        ) : null}

        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
          Availability summary: {availableCount} available · {cannotWorkDates.length} need off ·{' '}
          {requestToWorkCount} request to work
        </p>
      </header>

      {/* ── Stat cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3">
          <CalendarX2 className="h-5 w-5 shrink-0 text-[var(--error-text)]" aria-hidden />
          <div>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[var(--error-text)]/70">
              Need Off
            </p>
            <p className="text-2xl font-bold tabular-nums leading-none text-[var(--error-text)]">
              {cannotWorkDates.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[var(--info-border)] bg-[var(--info-subtle)] px-4 py-3">
          <CalendarCheck className="h-5 w-5 shrink-0 text-[var(--info-text)]" aria-hidden />
          <div>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[var(--info-text)]/70">
              Requested to Work
            </p>
            <p className="text-2xl font-bold tabular-nums leading-none text-[var(--info-text)]">
              {requestToWorkCount}
            </p>
          </div>
        </div>
      </div>

      {conflicts.length > 0 ? (
        <ScheduledConflictBanner conflicts={conflicts} onDismiss={() => {}} />
      ) : null}

      {/* ── Main form card ──────────────────────────── */}
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

        {/* Cycle selector */}
        <div className="flex flex-col gap-2 border-b border-border/80 px-5 py-3 sm:px-6">
          <div className="w-full max-w-[15rem] space-y-1 sm:max-w-[17.5rem]">
            <Label
              htmlFor="therapist_cycle_id"
              className="text-[0.6rem] font-medium uppercase tracking-[0.08em] text-muted-foreground/75"
            >
              Cycle
            </Label>
            <select
              id="therapist_cycle_id"
              title={
                selectedCycle
                  ? `${selectedCycle.label} · ${formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)}`
                  : undefined
              }
              className="h-10 w-full max-w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={selectedCycleId}
              onChange={(event) => handleCycleChange(event.target.value)}
            >
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {formatHumanCycleRange(cycle.start_date, cycle.end_date)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Instruction banner */}
        <div className="border-b border-[var(--info-border)] bg-[var(--info-subtle)] px-5 py-2.5 sm:px-6">
          <p className="text-xs font-medium leading-snug text-[var(--info-text)]">
            Tap a day to switch between Available, Need Off, and Request to Work. Select a day to
            add notes in the panel on the right.
          </p>
          <p className="mt-1 text-[11px] leading-snug text-[var(--info-text)]/90">
            Available = I can work · Need Off = I&apos;m requesting the day off · Request to Work =
            Please consider me for a shift
          </p>
        </div>

        {/* Two-column: calendar + sidebar */}
        <div className="grid grid-cols-1 divide-y divide-border/80 lg:grid-cols-[1fr_256px] lg:divide-x lg:divide-y-0">
          {/* ── Calendar ─────────────────────── */}
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            {/* DOW headers */}
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

            {/* Weeks */}
            <div className="mt-3 space-y-4">
              {weeks.map((week, idx) => (
                <div key={`week-${idx}`} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                      Week {idx + 1}
                    </p>
                    <div className="h-px flex-1 bg-border/80" />
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {week.map((date) => {
                      const status = draftStatusByDate[date] ?? 'none'
                      const dayIndex = cycleDays.indexOf(date)
                      const prevInCycle = dayIndex > 0 ? cycleDays[dayIndex - 1] : null
                      const monthRibbon = monthRibbonLabel(date, prevInCycle)
                      const dayNum = new Date(`${date}T00:00:00`).getDate()
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => handleDayClick(date)}
                          className={cn(
                            'relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center transition-[border-color,background-color] duration-150',
                            'hover:-translate-y-px focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                            status === 'none' &&
                              'border-border/20 bg-muted/10 hover:border-border/50 hover:bg-muted/20',
                            status === 'force_off' &&
                              'border-[var(--error-border)] bg-[var(--error-subtle)]',
                            status === 'force_on' &&
                              'border-[var(--info-border)] bg-[var(--info-subtle)]',
                            selectedDate === date &&
                              'ring-2 ring-primary/60 ring-offset-1 ring-offset-card'
                          )}
                          aria-pressed={selectedDate === date}
                          aria-label={`${formatDateLabel(date)}: ${therapistDayStatusLabel(status)}`}
                        >
                          {monthRibbon ? (
                            <span
                              className={cn(
                                'text-[0.5rem] font-semibold uppercase tracking-[0.1em]',
                                status === 'none' && 'text-muted-foreground/55',
                                status === 'force_off' && 'text-[var(--error-text)]/70',
                                status === 'force_on' && 'text-[var(--info-text)]/70'
                              )}
                            >
                              {monthRibbon}
                            </span>
                          ) : (
                            <span className="h-[0.5rem]" aria-hidden />
                          )}
                          <span
                            className={cn(
                              'text-[1.15rem] leading-none',
                              status === 'none'
                                ? 'font-medium text-muted-foreground/70'
                                : 'font-bold text-foreground'
                            )}
                          >
                            {dayNum}
                          </span>
                          {status !== 'none' ? (
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-1.5 py-px text-[0.5rem] font-semibold uppercase tracking-[0.05em]',
                                status === 'force_off' &&
                                  'bg-[var(--error-subtle)] text-[var(--error-text)] ring-1 ring-[var(--error-border)]/60',
                                status === 'force_on' &&
                                  'bg-[var(--info-subtle)] text-[var(--info-text)] ring-1 ring-[var(--info-border)]/60'
                              )}
                            >
                              {status === 'force_off' ? 'Need Off' : 'Request'}
                            </span>
                          ) : (
                            <span className="h-[0.5rem]" aria-hidden />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Sidebar ──────────────────────── */}
          <div className="flex flex-col gap-6 px-4 py-5">
            {/* Legend */}
            <div>
              <h3 className="mb-2.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Legend
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Need Off', dotClass: 'bg-[var(--error-text)]' },
                  { label: 'Request to Work', dotClass: 'bg-[var(--info-text)]' },
                  { label: 'No Preference (Available)', dotClass: 'bg-border' },
                ].map(({ label, dotClass }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dotClass)} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Day Notes */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Day Notes
                </h3>
                {selectedDate ? (
                  <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                    {new Date(`${selectedDate}T00:00:00`)
                      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      .toUpperCase()}
                  </span>
                ) : null}
              </div>

              {!selectedDate ? (
                <p className="text-xs italic text-muted-foreground">
                  Optional details for selected date.
                </p>
              ) : selectedDayStatus === 'none' ? (
                <p className="text-xs text-muted-foreground">
                  Notes are only saved for Need Off or Request to Work days.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <Label
                    htmlFor={`therapist-day-note-${selectedDate}`}
                    className="text-[11px] font-medium text-foreground"
                  >
                    Optional note
                  </Label>
                  <textarea
                    id={`therapist-day-note-${selectedDate}`}
                    ref={noteTextareaRef}
                    value={draftNotesByDate[selectedDate] ?? ''}
                    onChange={(event) => updateDateNote(selectedDate, event.target.value)}
                    placeholder="Add specific constraints or shift preferences for this day…"
                    className="min-h-[80px] w-full rounded-lg border border-border/15 bg-background px-2.5 py-1.5 text-xs text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/45 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                  {selectedDayNeedsClear ? (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        onClick={clearSelectedDay}
                      >
                        Clear day
                      </button>
                      {(draftNotesByDate[selectedDate] ?? '').trim().length > 0 ? (
                        <button
                          type="button"
                          className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          onClick={() => updateDateNote(selectedDate, '')}
                        >
                          Clear note
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Notes summary */}
            {daysWithNoteText.length > 0 ? (
              <div>
                <h3 className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Notes Added
                </h3>
                <ul className="space-y-1.5">
                  {daysWithNoteText.map((date) => {
                    const status = draftStatusByDate[date] ?? 'none'
                    const preview = (draftNotesByDate[date] ?? '').trim()
                    return (
                      <li
                        key={`note-summary-${date}`}
                        className="rounded-lg border border-border/60 bg-muted/10 px-2.5 py-1.5 text-xs"
                      >
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-medium text-foreground">
                            {formatDateLabel(date)}
                          </span>
                          <span
                            className={cn(
                              'font-medium',
                              status === 'force_off' && 'text-[var(--error-text)]',
                              status === 'force_on' && 'text-[var(--info-text)]'
                            )}
                          >
                            · {therapistDayStatusLabel(status)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                          &ldquo;{preview}&rdquo;
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-border/70 bg-muted/10 px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <p className="text-xs text-muted-foreground sm:mr-auto">
            Save progress keeps a draft. Submit availability marks this cycle as officially
            submitted.
          </p>
          {actionButtons}
        </div>
      </form>
    </section>
  )
}
