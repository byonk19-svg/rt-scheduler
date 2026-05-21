'use client'

import Link from 'next/link'
import { CalendarCheck, CalendarDays, CalendarX2, Check, Info, Send, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import type { AvailabilityEntryTableRow } from '@/app/availability/availability-requests-table'
import { ScheduledConflictBanner } from '@/components/availability/ScheduledConflictBanner'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { ConflictItem } from '@/lib/availability-scheduled-conflict'
import type { GeneratedAvailabilityBaselineDay } from '@/lib/availability-pattern-generator'
import { formatDateLabel, formatHumanCycleRange } from '@/lib/calendar-utils'
import {
  buildTherapistSubmissionUiState,
  resolveTherapistDeadlinePresentation,
} from '@/lib/therapist-availability-submission'
import { cn } from '@/lib/utils'

import {
  applyOverrideToDraft,
  applySelectionToDraft,
  buildAvailabilityDraftSummary,
  buildCopiedCycleDraft,
  buildCycleDays,
  buildNotesMap,
  buildRangeDates,
  buildStatusMap,
  clearAvailabilityDraft,
  getDisplayState,
  getDisplayStateLabel,
  hasAvailabilityDraftChanges,
  summarizeBaseline,
  updateDraftNote,
  type DayStatus,
  type NotesByDate,
  type StatusByDate,
} from './availability-workspace-model'

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
  todayKey: string
  hasSavedRecurringPattern: boolean
  recurringPatternSummary: string
  generatedBaselineByCycleId: Record<string, Record<string, GeneratedAvailabilityBaselineDay>>
  /** Official submission timestamps from therapist_availability_submissions (not inferred from overrides). */
  submissionsByCycleId: Record<string, { submittedAt: string; lastEditedAt: string }>
  regularShiftType?: 'day' | 'night'
  availabilityLocked?: boolean
  availabilityLockedReason?: string | null
  submitTherapistAvailabilityGridAction: (formData: FormData) => void | Promise<void>
  returnToPath?: '/availability' | '/therapist/availability'
}

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
const EMPTY_CONFLICTS: ConflictItem[] = []

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

function formatMonthDay(isoDate: string, includeYear = false): string {
  const value = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(value.getTime())) return isoDate
  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  })
}

function formatWeekRangeLabel(week: string[]): string {
  const first = week[0]
  const last = week[week.length - 1]
  if (!first || !last) return ''

  const firstDate = new Date(`${first}T12:00:00`)
  const lastDate = new Date(`${last}T12:00:00`)
  if (Number.isNaN(firstDate.getTime()) || Number.isNaN(lastDate.getTime())) return ''

  if (
    firstDate.getFullYear() === lastDate.getFullYear() &&
    firstDate.getMonth() === lastDate.getMonth()
  ) {
    return `${firstDate.toLocaleDateString('en-US', { month: 'short' })} ${firstDate.getDate()} - ${lastDate.getDate()}`
  }

  if (firstDate.getFullYear() === lastDate.getFullYear()) {
    return `${formatMonthDay(first)} - ${formatMonthDay(last)}`
  }

  return `${formatMonthDay(first, true)} - ${formatMonthDay(last, true)}`
}

function formatSelectedDayLabel(isoDate: string): string {
  const value = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(value.getTime())) return isoDate
  return value.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatReviewDateWithNote(isoDate: string, note: string | undefined): string {
  const label = formatMonthDay(isoDate)
  const trimmedNote = note?.trim()
  return trimmedNote ? `${label} (${trimmedNote})` : label
}

function formatReviewDateList(dates: string[], notesByDate: Record<string, string>): string {
  if (dates.length === 0) return 'None'
  return dates.map((date) => formatReviewDateWithNote(date, notesByDate[date])).join(', ')
}

function dayOfMonthFromIsoDate(isoDate: string): number {
  return Number.parseInt(isoDate.slice(8, 10), 10)
}

export function TherapistAvailabilityWorkspace({
  cycles,
  availabilityRows,
  conflicts = EMPTY_CONFLICTS,
  initialCycleId,
  todayKey,
  hasSavedRecurringPattern,
  recurringPatternSummary,
  generatedBaselineByCycleId,
  submissionsByCycleId,
  regularShiftType = 'day',
  availabilityLocked = false,
  availabilityLockedReason = null,
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

  const [draftStatusByDate, setDraftStatusByDate] = useState<StatusByDate>(initialStatusByDate)
  const [draftNotesByDate, setDraftNotesByDate] = useState<NotesByDate>(initialNotesByDate)

  const baselineByDate = useMemo(
    () => generatedBaselineByCycleId[selectedCycleId] ?? {},
    [generatedBaselineByCycleId, selectedCycleId]
  )

  const { canWorkDates, cannotWorkDates, notesPayload } = useMemo(
    () =>
      buildAvailabilityDraftSummary({
        statusByDate: draftStatusByDate,
        notesByDate: draftNotesByDate,
      }),
    [draftNotesByDate, draftStatusByDate]
  )
  const hasCycleSpecificChanges = canWorkDates.length > 0 || cannotWorkDates.length > 0

  const hasUnsavedChanges = useMemo(
    () =>
      hasAvailabilityDraftChanges(
        initialStatusByDate,
        draftStatusByDate,
        initialNotesByDate,
        draftNotesByDate
      ),
    [draftNotesByDate, draftStatusByDate, initialNotesByDate, initialStatusByDate]
  )

  function handleCycleChange(nextCycleId: string) {
    if (nextCycleId === selectedCycleId) return
    if (
      hasUnsavedChanges &&
      !window.confirm('You have unsaved changes. Switch Schedule Blocks and lose them?')
    ) {
      return
    }

    setSelectedCycleId(nextCycleId)
    setSelectedDate(null)
    setRangeStart('')
    setRangeEnd('')
    const nextRows = availabilityRows.filter((row) => row.cycleId === nextCycleId)
    setDraftStatusByDate(buildStatusMap(nextRows))
    setDraftNotesByDate(buildNotesMap(nextRows))
  }

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

  const baselineSummary = summarizeBaseline(cycleDays, baselineByDate)

  function setOverride(date: string, status: DayStatus | null) {
    const nextDraft = applyOverrideToDraft({
      statusByDate: draftStatusByDate,
      notesByDate: draftNotesByDate,
      date,
      status,
      baselineByDate,
    })
    setDraftStatusByDate(nextDraft.statusByDate)
    setDraftNotesByDate(nextDraft.notesByDate)
  }

  function updateSelectedDateNote(note: string) {
    if (!selectedDate) return
    setDraftNotesByDate((current) => updateDraftNote(current, selectedDate, note))
  }

  const rangeDates = useMemo(
    () => buildRangeDates(cycleDays, rangeStart, rangeEnd),
    [cycleDays, rangeEnd, rangeStart]
  )

  const activeSelectionDates = useMemo(
    () => (rangeDates.length > 0 ? rangeDates : selectedDate ? [selectedDate] : []),
    [rangeDates, selectedDate]
  )

  function applySelection(status: DayStatus | null) {
    const nextDraft = applySelectionToDraft({
      statusByDate: draftStatusByDate,
      notesByDate: draftNotesByDate,
      dates: activeSelectionDates,
      status,
      baselineByDate,
    })
    setDraftStatusByDate(nextDraft.statusByDate)
    setDraftNotesByDate(nextDraft.notesByDate)
  }

  function clearOverrides() {
    const nextDraft = clearAvailabilityDraft()
    setDraftStatusByDate(nextDraft.statusByDate)
    setDraftNotesByDate(nextDraft.notesByDate)
  }

  function copyPreviousCycleOverrides() {
    const nextDraft = buildCopiedCycleDraft({
      cycles,
      availabilityRows,
      selectedCycleId,
      baselineByDate,
    })
    if (!nextDraft) return
    setDraftStatusByDate(nextDraft.statusByDate)
    setDraftNotesByDate(nextDraft.notesByDate)
  }

  const cyclePageSubtitle = useMemo(() => {
    if (!selectedCycle) return 'Select a Schedule Block to enter availability.'
    const range = `Schedule Block: ${formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)}`
    if (selectedCycle.published) {
      return `${range} · Published ${formatDateLabel(selectedCycle.start_date)}`
    }
    return range
  }, [selectedCycle])

  const selectedOverride = selectedDate ? (draftStatusByDate[selectedDate] ?? null) : null
  const selectedNote = selectedDate ? (draftNotesByDate[selectedDate] ?? '') : ''
  const hasActiveSelection = activeSelectionDates.length > 0
  const activeSelectionSummary =
    rangeDates.length > 0
      ? `${rangeDates.length} ${rangeDates.length === 1 ? 'day' : 'days'} selected`
      : selectedDate
        ? formatDateLabel(selectedDate)
        : 'Select a day to make a change.'
  const dueDateLabel = selectedCycle?.availability_due_at
    ? formatDateLabel(selectedCycle.availability_due_at.slice(0, 10))
    : null
  const regularShiftLabel = regularShiftType === 'night' ? 'Night shift' : 'Day shift'
  const reviewNeedOffSummary = formatReviewDateList(cannotWorkDates, draftNotesByDate)
  const reviewNeedToWorkSummary = formatReviewDateList(canWorkDates, draftNotesByDate)
  const reviewBlockLabel = selectedCycle
    ? formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)
    : 'No Schedule Block selected'
  const reviewWindowLabel = submissionUi.isSubmitted
    ? 'Submitted availability'
    : (deadlinePresentation?.deadlineHeadline ?? 'Availability open')
  const submissionStatusDetail = submissionUi.isSubmitted
    ? hasCycleSpecificChanges
      ? 'Submitted with changes for this Schedule Block.'
      : hasSavedRecurringPattern
        ? 'Submitted with no Schedule Block changes. Your normal schedule is your current response.'
        : 'Submitted with no day-level changes. This Schedule Block is currently blank unless you add dates.'
    : dueDateLabel
      ? `Due ${dueDateLabel}`
      : (deadlinePresentation?.deadlineHeadline ?? 'Save progress until you are ready to submit.')
  const availabilityLockedMessage =
    availabilityLockedReason === 'schedule_building_started'
      ? 'Schedule building has started. Ask a manager to reopen availability if you need to make a late change.'
      : availabilityLockedReason === 'manager_closed'
        ? 'Availability is locked for this Schedule Block. Ask a manager to reopen it if you need to make a late change.'
        : availabilityLocked
          ? 'Availability changes are locked for this Schedule Block.'
          : null
  const selectedDayOptionClass = (active: boolean, tone: 'can' | 'cant' | 'neutral') =>
    cn(
      'flex min-h-10 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
      active && tone === 'can' && 'bg-[color:color-mix(in_srgb,var(--success-subtle)_55%,white)]',
      active && tone === 'cant' && 'bg-[color:color-mix(in_srgb,var(--error-subtle)_55%,white)]',
      active && tone === 'neutral' && 'bg-[color:color-mix(in_srgb,var(--muted)_46%,white)]',
      !active && 'bg-background hover:bg-muted/[0.08]'
    )

  if (cycles.length === 0) {
    return (
      <section id="therapist-availability-workspace" className="space-y-3">
        <header className="border-b border-border/70 pb-4">
          <h1 className="app-page-title">Future Availability</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            No upcoming Schedule Block is open for availability yet. Check back after your manager
            opens the next Schedule Block.
          </p>
        </header>
      </section>
    )
  }

  return (
    <section id="therapist-availability-workspace" className="space-y-4">
      <header className="space-y-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-1.5">
            <div className="space-y-1">
              <h1 className="app-page-title">Future Availability</h1>
              <p className="text-sm text-muted-foreground">{cyclePageSubtitle}</p>
            </div>
            {hasUnsavedChanges ? (
              <div className="inline-flex items-center rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-1 text-xs font-semibold text-[var(--warning-text)]">
                Draft changes not yet saved
              </div>
            ) : null}
          </div>

          <section className="rounded-[1.15rem] border border-border/70 bg-card px-4 py-3.5 shadow-tw-2xs-soft">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Submission status
            </p>
            <span
              className={cn(
                'mt-2.5 inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-semibold',
                submissionUi.isSubmitted
                  ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
                  : 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
              )}
            >
              {submissionUi.isSubmitted ? 'Submitted' : 'Not submitted'}
            </span>
            <p
              className={cn(
                'mt-2.5 text-sm',
                !submissionUi.isSubmitted &&
                  deadlinePresentation?.emphasis === 'past' &&
                  'text-[var(--error-text)]',
                !submissionUi.isSubmitted &&
                  deadlinePresentation?.emphasis === 'urgent' &&
                  'text-[var(--warning-text)]',
                (!deadlinePresentation || deadlinePresentation.emphasis === 'neutral') &&
                  'text-muted-foreground'
              )}
            >
              {submissionStatusDetail}
            </p>
          </section>
        </div>

        <section className="rounded-[1.25rem] border border-border/70 bg-card px-5 py-4 shadow-tw-2xs-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--success-subtle)_55%,white)] text-[var(--primary)]">
                <CalendarDays className="h-5 w-5" aria-hidden />
              </div>
              <div className="space-y-1">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Starting point for this Schedule Block
                </p>
                <p className="text-lg font-semibold text-foreground">{recurringPatternSummary}</p>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {hasSavedRecurringPattern
                    ? 'We used your normal schedule to fill this Schedule Block. Changes here stay in this Schedule Block only.'
                    : 'This Schedule Block starts blank. Add days you Need to Work or Need Off. Changes here stay in this Schedule Block only.'}
                </p>
                {submissionUi.isSubmitted && !hasCycleSpecificChanges ? (
                  <p className="text-sm font-medium text-foreground">
                    {hasSavedRecurringPattern
                      ? 'You already submitted this Schedule Block without adding changes for this Schedule Block.'
                      : 'You already submitted this Schedule Block with a blank response.'}
                  </p>
                ) : null}
              </div>
            </div>

            <Button asChild variant="outline" size="sm" className="min-h-11 px-4">
              <Link href="/therapist/recurring-pattern">
                {hasSavedRecurringPattern ? 'Edit recurring pattern' : 'Set recurring pattern'}
              </Link>
            </Button>
          </div>
        </section>
      </header>

      {conflicts.length > 0 ? (
        <ScheduledConflictBanner conflicts={conflicts} onDismiss={() => {}} />
      ) : null}

      {availabilityLockedMessage ? (
        <section className="rounded-[1.1rem] border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-4 py-3 text-sm font-medium text-[var(--warning-text)]">
          {availabilityLockedMessage}
        </section>
      ) : null}

      <form
        action={submitTherapistAvailabilityGridAction}
        className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-tw-2xs-soft"
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

        <div className="space-y-2 border-b border-border/60 bg-[color:color-mix(in_srgb,var(--background)_42%,white)] px-5 py-3 sm:px-6">
          <div className="grid overflow-hidden rounded-[1rem] border border-border/70 bg-background xl:grid-cols-[15.5rem_minmax(0,1fr)]">
            <section className="px-3.5 py-3">
              <Label
                htmlFor="therapist_cycle_id"
                className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                Schedule Block
              </Label>
              <select
                id="therapist_cycle_id"
                value={selectedCycleId}
                onChange={(event) => handleCycleChange(event.target.value)}
                className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              >
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {formatHumanCycleRange(cycle.start_date, cycle.end_date)}
                  </option>
                ))}
              </select>
            </section>

            <section className="border-t border-border/70 px-3.5 py-3 xl:border-l xl:border-t-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-[13rem]">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Quick edit
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Select one day or several days, then choose a state.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <p className="rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {activeSelectionSummary}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasActiveSelection || availabilityLocked}
                    onClick={() => applySelection('force_on')}
                    className="min-h-9 rounded-xl border-[var(--success-border)] bg-[var(--success-subtle)]/35 px-3 text-[var(--success-text)] hover:bg-[var(--success-subtle)]"
                  >
                    <CalendarCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Need to Work
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasActiveSelection || availabilityLocked}
                    onClick={() => applySelection('force_off')}
                    className="min-h-9 rounded-xl border-[var(--error-border)] bg-[var(--error-subtle)]/35 px-3 text-[var(--error-text)] hover:bg-[var(--error-subtle)]"
                  >
                    <CalendarX2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Need Off
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasActiveSelection || availabilityLocked}
                    onClick={() => applySelection(null)}
                    className="min-h-9 rounded-xl px-3"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </section>
          </div>

          <details className="rounded-[0.95rem] border border-border/60 bg-background px-3.5 py-2.5">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Edit several days
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="range-start">Start date</Label>
                  <input
                    id="range-start"
                    type="date"
                    min={selectedCycle?.start_date}
                    max={selectedCycle?.end_date}
                    value={rangeStart}
                    onChange={(event) => setRangeStart(event.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="range-end">End date</Label>
                  <input
                    id="range-end"
                    type="date"
                    min={selectedCycle?.start_date}
                    max={selectedCycle?.end_date}
                    value={rangeEnd}
                    onChange={(event) => setRangeEnd(event.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-muted-foreground lg:max-w-[16rem]">
                  Dates selected here use the quick edit buttons above.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyPreviousCycleOverrides}
                  className="min-h-9 rounded-xl px-3"
                >
                  Use previous Schedule Block
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearOverrides}
                  className="min-h-9 rounded-xl px-3"
                >
                  Clear block changes
                </Button>
              </div>
            </div>
          </details>
        </div>

        <div
          data-slot="availability-workspace-split"
          className="grid items-start gap-4 px-5 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_19rem]"
        >
          <div className="min-w-0 space-y-3">
            <div className="hidden grid-cols-[5.4rem_repeat(7,minmax(0,1fr))] gap-1.5 text-center text-[0.66rem] font-semibold tracking-[0.1em] text-muted-foreground sm:grid">
              <span />
              {DOW.map((dow) => (
                <p key={dow}>{dow}</p>
              ))}
            </div>

            <div className="space-y-2.5">
              {weeks.map((week, weekIndex) => (
                <div
                  key={`week-${weekIndex}`}
                  className="rounded-[1rem] border border-border/55 bg-card p-2.5 sm:grid sm:grid-cols-[5.4rem_repeat(7,minmax(0,1fr))] sm:gap-1.5"
                >
                  <div className="mb-3 flex items-end justify-between sm:mb-0 sm:block sm:pr-2">
                    <div>
                      <p className="text-[0.82rem] font-semibold text-foreground">
                        Week {weekIndex + 1}
                      </p>
                      <p className="mt-0.5 text-[0.72rem] text-muted-foreground">
                        {formatWeekRangeLabel(week)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 sm:col-span-7 sm:contents">
                    {week.map((date) => {
                      const displayState = getDisplayState(date, draftStatusByDate, baselineByDate)
                      const showStatusLabel =
                        displayState === 'can_work' || displayState === 'cannot_work'
                      const dayIndex = cycleDays.indexOf(date)
                      const monthRibbon = monthRibbonLabel(
                        date,
                        dayIndex > 0 ? cycleDays[dayIndex - 1] : null
                      )
                      const dayNum = dayOfMonthFromIsoDate(date)

                      return (
                        <button
                          key={date}
                          type="button"
                          aria-label={formatDateLabel(date)}
                          aria-pressed={selectedDate === date}
                          disabled={availabilityLocked}
                          onClick={() => {
                            setSelectedDate(date)
                            setRangeStart('')
                            setRangeEnd('')
                            requestAnimationFrame(() => noteTextareaRef.current?.focus())
                          }}
                          className={cn(
                            'flex min-h-[4.25rem] flex-col items-start justify-between rounded-[0.85rem] border px-1.5 py-1.5 text-left transition-all duration-150 hover:-translate-y-px hover:shadow-tw-day-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 sm:min-h-[4.95rem] sm:px-2.5',
                            displayState === 'can_work'
                              ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)] hover:border-[var(--success-text)]'
                              : displayState === 'cannot_work'
                                ? 'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)] hover:border-[var(--error-text)]'
                                : displayState === 'normal_work'
                                  ? 'border-[color:color-mix(in_srgb,var(--success-border)_22%,var(--border))] bg-[color:color-mix(in_srgb,var(--success-subtle)_10%,white)] text-foreground hover:border-[var(--success-border)] hover:bg-[color:color-mix(in_srgb,var(--success-subtle)_24%,white)]'
                                  : displayState === 'normal_off'
                                    ? 'border-border/60 bg-[color:color-mix(in_srgb,var(--muted)_22%,white)] text-foreground hover:border-[var(--error-border)] hover:bg-[color:color-mix(in_srgb,var(--error-subtle)_18%,white)]'
                                    : 'border-border/55 bg-background text-foreground hover:border-primary/40 hover:bg-[color:color-mix(in_srgb,var(--primary)_5%,white)]',
                            selectedDate === date &&
                              'border-primary bg-[color:color-mix(in_srgb,var(--primary)_8%,white)] shadow-tw-day-selected ring-2 ring-primary/35',
                            date === todayKey && selectedDate !== date && 'shadow-tw-ring-attention'
                          )}
                        >
                          <div className="space-y-1">
                            {monthRibbon ? (
                              <span className="text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                                {monthRibbon}
                              </span>
                            ) : (
                              <span className="block h-[0.65rem]" aria-hidden />
                            )}
                            <span className="text-[1.25rem] font-bold leading-none text-foreground sm:text-[1.48rem]">
                              {dayNum}
                            </span>
                          </div>
                          {showStatusLabel ? (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.58rem] font-semibold tracking-[0.04em]',
                                displayState === 'can_work' &&
                                  'bg-[color:color-mix(in_srgb,var(--success-subtle)_80%,white)] text-[var(--success-text)]',
                                displayState === 'cannot_work' &&
                                  'bg-[color:color-mix(in_srgb,var(--error-subtle)_80%,white)] text-[var(--error-text)]'
                              )}
                            >
                              {displayState === 'can_work' ? (
                                <Check className="h-3 w-3" aria-hidden />
                              ) : (
                                <X className="h-3 w-3" aria-hidden />
                              )}
                              {getDisplayStateLabel(displayState)}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 rounded-[1rem] border border-border/55 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Save progress keeps this as a draft.
                </p>
                <p className="text-xs text-muted-foreground">
                  Submit availability sends this Schedule Block to managers.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                {!submissionUi.isSubmitted ? (
                  <>
                    <FormSubmitButton
                      type="submit"
                      name="workflow"
                      value="draft"
                      variant="ghost"
                      size="sm"
                      disabled={availabilityLocked}
                      pendingText="Saving..."
                      className="min-h-10 rounded-xl px-4 font-semibold text-muted-foreground hover:text-foreground sm:min-w-[9rem]"
                    >
                      Save progress
                    </FormSubmitButton>
                    <FormSubmitButton
                      type="submit"
                      name="workflow"
                      value="submit"
                      size="sm"
                      disabled={availabilityLocked}
                      pendingText="Submitting..."
                      className="min-h-11 gap-2 rounded-xl px-5 font-semibold shadow-sm sm:min-w-[11.5rem]"
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
                    disabled={availabilityLocked}
                    pendingText="Saving changes..."
                    className="min-h-11 gap-2 rounded-xl px-5 font-semibold shadow-sm"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden />
                    Save changes
                  </FormSubmitButton>
                )}
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-3 xl:self-start">
            <section className="order-2 rounded-[1.1rem] border border-border/70 bg-[color:color-mix(in_srgb,var(--background)_45%,white)] px-4 py-4 shadow-tw-sm xl:order-1">
              <h3 className="text-[0.95rem] font-semibold text-foreground">
                Review before submitting
              </h3>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Schedule Block
                  </dt>
                  <dd className="mt-1 text-foreground">{reviewBlockLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Regular shift
                  </dt>
                  <dd className="mt-1 text-foreground">{regularShiftLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Need Off
                  </dt>
                  <dd className="mt-1 text-foreground">{reviewNeedOffSummary}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Need to Work
                  </dt>
                  <dd className="mt-1 text-foreground">{reviewNeedToWorkSummary}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Edit window
                  </dt>
                  <dd className="mt-1 text-foreground">{reviewWindowLabel}</dd>
                </div>
              </dl>
              {!hasCycleSpecificChanges ? (
                <p className="mt-3 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
                  No exceptions selected for this Schedule Block.
                </p>
              ) : null}
            </section>

            <section className="order-3 rounded-[1.1rem] border border-border/70 bg-[color:color-mix(in_srgb,var(--background)_45%,white)] px-4 py-4 shadow-tw-sm xl:order-2">
              <h3 className="text-[0.95rem] font-semibold text-foreground">
                Current starting point
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasSavedRecurringPattern
                  ? 'These counts come from your normal schedule before changes for this Schedule Block.'
                  : 'These counts show how many days still start blank before you add changes for this Schedule Block.'}
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-3 text-muted-foreground">
                    <span className="h-6 w-0.5 rounded-full bg-[var(--success-text)]" />
                    Normally working
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {baselineSummary.normalWork}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-3 text-muted-foreground">
                    <span className="h-6 w-0.5 rounded-full bg-[var(--error-text)]" />
                    Normally off
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {baselineSummary.normalOff}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-3 text-muted-foreground">
                    <span className="h-6 w-0.5 rounded-full bg-border" />
                    Unmarked
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {baselineSummary.notSet}
                  </span>
                </div>
              </div>

              <div className="my-3 h-px bg-border/70" />

              <h3 className="text-[0.95rem] font-semibold text-foreground">
                This Schedule Block changes
              </h3>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-3 text-muted-foreground">
                    <span className="h-6 w-0.5 rounded-full bg-[var(--success-text)]" />
                    Need to Work
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {canWorkDates.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-3 text-muted-foreground">
                    <span className="h-6 w-0.5 rounded-full bg-[var(--error-text)]" />
                    Need Off
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {cannotWorkDates.length}
                  </span>
                </div>
              </div>

              <div className="my-3 h-px bg-border/70" />

              <div className="flex items-center justify-between">
                <h3 className="text-[0.95rem] font-semibold text-foreground">Legend</h3>
                <Info className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--success-text)]" />
                  <span>Need to Work</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--error-text)]" />
                  <span>Need Off</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-border" />
                  <span>Unmarked</span>
                </div>
              </div>
            </section>

            <section className="order-1 rounded-[1.1rem] border border-border/70 bg-[color:color-mix(in_srgb,var(--background)_45%,white)] px-4 py-4 shadow-tw-sm xl:order-3">
              <h3 className="text-[0.95rem] font-semibold text-foreground">Selected day</h3>
              {!selectedDate ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Click a day to review it and make a change.
                </p>
              ) : (
                <div className="mt-3 space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {formatSelectedDayLabel(selectedDate)}
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
                    <button
                      type="button"
                      onClick={() => setOverride(selectedDate, 'force_on')}
                      disabled={availabilityLocked}
                      className={selectedDayOptionClass(selectedOverride === 'force_on', 'can')}
                    >
                      <span className="flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full border border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]">
                        {selectedOverride === 'force_on' ? (
                          <Check className="h-3 w-3" aria-hidden />
                        ) : null}
                      </span>
                      <span className="text-sm font-medium text-foreground">Need to Work</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOverride(selectedDate, 'force_off')}
                      disabled={availabilityLocked}
                      className={cn(
                        selectedDayOptionClass(selectedOverride === 'force_off', 'cant'),
                        'border-t border-border/70'
                      )}
                    >
                      <span className="flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full border border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]">
                        {selectedOverride === 'force_off' ? (
                          <X className="h-3 w-3" aria-hidden />
                        ) : null}
                      </span>
                      <span className="text-sm font-medium text-foreground">Need Off</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOverride(selectedDate, null)}
                      disabled={availabilityLocked}
                      className={cn(
                        selectedDayOptionClass(selectedOverride === null, 'neutral'),
                        'border-t border-border/70'
                      )}
                    >
                      <span className="flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full border border-border/70 bg-background">
                        {selectedOverride === null ? (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        ) : null}
                      </span>
                      <span className="text-sm font-medium text-foreground">Unmarked</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`therapist-day-note-${selectedDate}`} className="text-sm">
                        Add a note (optional)
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {selectedNote.length} / 200
                      </span>
                    </div>
                    {/* Persisted notes only exist for days you change for this Schedule Block. */}
                    <textarea
                      id={`therapist-day-note-${selectedDate}`}
                      ref={noteTextareaRef}
                      value={selectedNote}
                      maxLength={200}
                      onChange={(event) => updateSelectedDateNote(event.target.value)}
                      placeholder="Add a note for this day..."
                      disabled={!selectedOverride || availabilityLocked}
                      className="min-h-[86px] w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    {!selectedOverride ? (
                      <p className="text-xs text-muted-foreground">
                        Notes are only saved for days you change for this Schedule Block.
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>
      </form>
    </section>
  )
}
