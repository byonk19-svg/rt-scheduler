'use client'

import { Send } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { AvailabilityEntryTableRow } from '@/app/availability/availability-requests-table'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Label } from '@/components/ui/label'
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
  initialCycleId: string
  /** Official submission timestamps from therapist_availability_submissions (not inferred from overrides). */
  submissionsByCycleId: Record<string, { submittedAt: string; lastEditedAt: string }>
  submitTherapistAvailabilityGridAction: (formData: FormData) => void | Promise<void>
  returnToPath?: '/availability' | '/therapist/availability'
}

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
type DayStatus = 'none' | 'force_on' | 'force_off'

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

  function handleCycleChange(nextCycleId: string) {
    setSelectedCycleId(nextCycleId)
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

  const noteDates = useMemo(
    () =>
      cycleDays.filter((date) => {
        const status = draftStatusByDate[date] ?? 'none'
        return status !== 'none'
      }),
    [cycleDays, draftStatusByDate]
  )
  const notesPayload = useMemo(
    () =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(draftNotesByDate)
            .map(([date, note]) => [date, note.trim()])
            .filter(([, note]) => note.length > 0)
        )
      ),
    [draftNotesByDate]
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
            className="h-10 shrink-0 px-4 font-semibold sm:min-w-[8.5rem]"
          >
            Save progress
          </FormSubmitButton>
          <FormSubmitButton
            type="submit"
            name="workflow"
            value="submit"
            size="sm"
            pendingText="Saving…"
            className="h-10 shrink-0 gap-2 px-5 font-semibold shadow-sm sm:min-w-[10.5rem]"
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
          className="h-10 shrink-0 gap-2 px-5 font-semibold shadow-sm"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          Save changes
        </FormSubmitButton>
      )}
    </div>
  )

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

  if (cycles.length === 0) {
    return (
      <section id="therapist-availability-workspace" className="space-y-3">
        <header className="border-b border-border/70 pb-4">
          <h1 className="font-heading text-[1.4rem] font-semibold leading-tight tracking-tight text-foreground">
            Availability for This Cycle
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            No upcoming cycle is open for availability yet.
          </p>
        </header>
      </section>
    )
  }

  return (
    <section id="therapist-availability-workspace" className="space-y-5">
      <header className="border-b border-border/70 pb-4">
        <h1 className="font-heading text-[1.4rem] font-semibold leading-tight tracking-tight text-foreground">
          Availability for This Cycle
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{cyclePageSubtitle}</p>
        {deadlinePresentation ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2">
              <span
                className={cn(
                  'w-fit shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold',
                  submissionUi.isSubmitted
                    ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
                    : 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                )}
              >
                {submissionPrimaryLabel}
              </span>
              {!submissionUi.isSubmitted && deadlinePresentation.deadlineHeadline ? (
                <p
                  className={cn(
                    'min-w-0 text-base font-semibold leading-snug tracking-tight',
                    deadlinePresentation.emphasis === 'past' && 'text-[var(--error-text)]',
                    deadlinePresentation.emphasis === 'urgent' && 'text-[var(--warning-text)]',
                    deadlinePresentation.emphasis === 'neutral' && 'text-foreground'
                  )}
                >
                  {deadlinePresentation.deadlineHeadline}
                </p>
              ) : null}
              {submissionUi.isSubmitted && deadlinePresentation.submittedPrimaryLine ? (
                <p className="min-w-0 text-base font-semibold leading-snug text-foreground">
                  {deadlinePresentation.submittedPrimaryLine}
                </p>
              ) : null}
            </div>
            {submissionUi.isSubmitted && deadlinePresentation.submittedDeadlineContextLine ? (
              <p className="text-sm font-medium text-muted-foreground">
                {deadlinePresentation.submittedDeadlineContextLine}
              </p>
            ) : null}
          </div>
        ) : null}
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

      <form
        action={submitTherapistAvailabilityGridAction}
        className="overflow-hidden rounded-[20px] border border-border/80 bg-card shadow-[0_1px_0_rgba(15,23,42,0.03)]"
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

        <div className="border-b border-[var(--info-border)] bg-[var(--info-subtle)] px-5 py-2 sm:px-6">
          <p className="text-xs font-medium leading-snug text-[var(--info-text)]">
            Tap a day to switch between Available, Need Off, and Request to Work. Add an optional
            note if needed.
          </p>
          <p className="mt-1 text-[11px] leading-snug text-[var(--info-text)]/95">
            Available = I can work · Need Off = I&apos;m requesting the day off · Request to Work =
            Please consider me for a shift (not guaranteed)
          </p>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="grid grid-cols-7 gap-3 border-y border-border/80 py-2.5">
            {DOW.map((dow) => (
              <p
                key={dow}
                className="text-center text-[0.68rem] font-semibold tracking-[0.1em] text-muted-foreground"
              >
                {dow}
              </p>
            ))}
          </div>

          {weeks.map((week, idx) => (
            <div key={`week-${idx}`} className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                  Week {idx + 1}
                </p>
                <div className="h-px flex-1 bg-border/90" />
              </div>
              <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
                {week.map((date) => {
                  const status = draftStatusByDate[date] ?? 'none'
                  const dayIndex = cycleDays.indexOf(date)
                  const prevInCycle = dayIndex > 0 ? cycleDays[dayIndex - 1] : null
                  const monthRibbon = monthRibbonLabel(date, prevInCycle)
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => toggleDate(date)}
                      className={cn(
                        'flex min-h-[5.75rem] flex-col items-center justify-center rounded-[20px] border px-1 py-2 text-center shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-[border-color,box-shadow,transform,background-color] duration-200',
                        'hover:-translate-y-px focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                        status === 'none' &&
                          'border-border/25 bg-muted/10 text-muted-foreground/85 shadow-none hover:border-primary/15 hover:bg-muted/18',
                        status === 'force_off' &&
                          'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)] shadow-[0_2px_8px_-4px_rgba(15,23,42,0.2)] ring-1 ring-[var(--error-border)]/35',
                        status === 'force_on' &&
                          'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)] shadow-[0_2px_8px_-4px_rgba(15,23,42,0.18)] ring-1 ring-[var(--info-border)]/40'
                      )}
                      aria-label={`${formatDateLabel(date)}: ${
                        status === 'none'
                          ? 'Available'
                          : status === 'force_off'
                            ? 'Need Off'
                            : 'Request to Work'
                      }`}
                    >
                      {monthRibbon ? (
                        <span
                          className={cn(
                            'mb-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em]',
                            status === 'none' && 'text-muted-foreground/65',
                            status === 'force_on' && 'text-[var(--info-text)]/90',
                            status === 'force_off' && 'text-[var(--error-text)]/90'
                          )}
                        >
                          {monthRibbon}
                        </span>
                      ) : (
                        <span className="mb-0.5 h-[0.58rem]" aria-hidden />
                      )}
                      <span
                        className={cn(
                          'text-[1.2rem] leading-none tracking-[-0.03em]',
                          status === 'none'
                            ? 'font-medium text-muted-foreground/75'
                            : 'font-bold text-foreground'
                        )}
                      >
                        {new Date(`${date}T00:00:00`).getDate()}
                      </span>
                      <span
                        className={cn(
                          'mt-1.5 block max-w-full px-0.5 text-[0.62rem] leading-snug',
                          status === 'none' && 'font-medium text-muted-foreground/75',
                          status === 'force_off' && 'font-semibold',
                          status === 'force_on' && 'font-semibold'
                        )}
                      >
                        {status === 'none'
                          ? 'Available'
                          : status === 'force_off'
                            ? 'Need Off'
                            : 'Request to Work'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-border/70 bg-muted/10 px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          {actionButtons}
        </div>

        <div className="border-t border-border/70 px-5 py-5 sm:px-6">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Day Notes</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional context for Need Off or Request to Work days.
              </p>
            </div>
            {noteDates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No day-specific notes yet.</p>
            ) : (
              <div className="space-y-3">
                {noteDates.map((date) => {
                  const status = draftStatusByDate[date] ?? 'none'
                  const statusLabel =
                    status === 'force_off'
                      ? 'Need Off'
                      : status === 'force_on'
                        ? 'Request to Work'
                        : 'Available'
                  return (
                    <div
                      key={`note-${date}`}
                      className="rounded-2xl border border-border/80 bg-muted/10 px-4 py-3"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {formatDateLabel(date)}
                        </p>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
                            status === 'force_off' &&
                              'bg-[var(--error-subtle)] text-[var(--error-text)]',
                            status === 'force_on' &&
                              'bg-[var(--info-subtle)] text-[var(--info-text)]'
                          )}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <textarea
                        value={draftNotesByDate[date] ?? ''}
                        onChange={(event) => updateDateNote(date, event.target.value)}
                        placeholder={
                          status === 'force_off'
                            ? 'Optional: why you need this day off'
                            : 'Optional: add context for your request to work'
                        }
                        className="min-h-[72px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </form>
    </section>
  )
}
