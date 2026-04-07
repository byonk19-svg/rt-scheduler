'use client'

import { Send } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { AvailabilityEntryTableRow } from '@/app/availability/availability-requests-table'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Label } from '@/components/ui/label'
import { addDays, formatDateLabel, toIsoDate } from '@/lib/calendar-utils'
import { cn } from '@/lib/utils'

type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
}

type Props = {
  cycles: Cycle[]
  availabilityRows: AvailabilityEntryTableRow[]
  initialCycleId: string
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

function formatSubmissionTimestamp(value: Date | null): string | null {
  if (!value) return null
  return value.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function TherapistAvailabilityWorkspace({
  cycles,
  availabilityRows,
  initialCycleId,
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

  const cycleDateRangeLabel = selectedCycle
    ? `${formatDateLabel(selectedCycle.start_date)} – ${formatDateLabel(selectedCycle.end_date)}`
    : ''
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
  const totalDaysSelected = cycleDays.length
  const latestSubmittedAt = useMemo(() => {
    const timestamps = cycleRows
      .map((row) => new Date(row.createdAt).getTime())
      .filter((value) => Number.isFinite(value))
    if (timestamps.length === 0) return null
    return new Date(Math.max(...timestamps))
  }, [cycleRows])
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

  const submissionStatus = hasUnsavedChanges
    ? 'Draft not submitted'
    : latestSubmittedAt
      ? 'Submitted'
      : 'Draft not submitted'
  const latestSubmittedLabel = formatSubmissionTimestamp(latestSubmittedAt)
  const submissionStatusDetail = hasUnsavedChanges
    ? latestSubmittedLabel
      ? `Submitted on ${latestSubmittedLabel} · new edits not submitted`
      : 'Your selections are still a draft until you submit availability.'
    : latestSubmittedLabel
      ? `Submitted on ${latestSubmittedLabel}`
      : 'Choose your availability for this cycle, then submit when ready.'

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
      <section
        id="therapist-availability-workspace"
        className="rounded-2xl border border-border bg-card px-6 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
      >
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Submit Availability
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No upcoming cycle is open for availability yet.
        </p>
      </section>
    )
  }

  return (
    <section id="therapist-availability-workspace" className="space-y-4">
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

        <div className="flex flex-col gap-5 border-b border-border/80 px-5 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <h2 className="app-page-title text-foreground">Submit Availability</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {selectedCycle ? (
                <>
                  <span className="font-medium text-foreground">Cycle:</span>{' '}
                  <span>{cycleDateRangeLabel}</span>
                </>
              ) : (
                'Select a cycle to enter availability.'
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-1 text-[11px] font-semibold text-[var(--warning-text)]">
                {submissionStatus}
              </span>
              <span className="rounded-full border border-border/70 bg-muted/15 px-3 py-1 text-[11px] text-muted-foreground">
                {submissionStatusDetail}
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto lg:min-w-[280px] lg:max-w-sm">
            <div className="w-full flex-1 space-y-1.5">
              <Label
                htmlFor="therapist_cycle_id"
                className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground"
              >
                Schedule cycle
              </Label>
              <select
                id="therapist_cycle_id"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={selectedCycleId}
                onChange={(event) => handleCycleChange(event.target.value)}
              >
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.label} ({cycle.start_date} to {cycle.end_date})
                  </option>
                ))}
              </select>
            </div>
            <FormSubmitButton
              type="submit"
              size="sm"
              pendingText="Saving..."
              className="h-10 shrink-0 gap-2 px-5 font-semibold shadow-sm sm:self-end"
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
              Submit Availability
            </FormSubmitButton>
          </div>
        </div>

        <div className="border-b border-border/60 bg-muted/15 px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{totalDaysSelected} days selected</p>
            <p className="tabular-nums">
              <span className="font-semibold text-foreground">{availableCount}</span> available ·{' '}
              <span className="font-semibold text-foreground">{cannotWorkDates.length}</span> need
              off · <span className="font-semibold text-foreground">{requestToWorkCount}</span>{' '}
              request to work
            </p>
          </div>
        </div>

        <div className="border-b border-[var(--info-border)] bg-[var(--info-subtle)] px-5 py-3 sm:px-6">
          <p className="text-xs font-medium leading-snug text-[var(--info-text)]">
            Tap a day to switch between Available, Need Off, and Request to Work. Add an optional
            note for more detail.
          </p>
        </div>

        <div className="border-b border-border/70 bg-card px-5 py-4 sm:px-6">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-2xl border border-border/80 bg-muted/10 px-3 py-3">
              <p className="text-sm font-semibold text-foreground">Available</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                I can work this day.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--error-border)] bg-[var(--error-subtle)]/50 px-3 py-3">
              <p className="text-sm font-semibold text-[var(--error-text)]">Need Off</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--error-text)]/80">
                I am requesting this day off.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--info-border)] bg-[var(--info-subtle)]/60 px-3 py-3">
              <p className="text-sm font-semibold text-[var(--info-text)]">Request to Work</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--info-text)]/80">
                I would like to be considered for a shift on this day.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 py-6 sm:px-6 sm:py-7">
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
                          'border-border/80 bg-card text-foreground hover:border-primary/25 hover:shadow-[0_14px_28px_-22px_rgba(15,23,42,0.35)]',
                        status === 'force_off' &&
                          'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)] shadow-[0_1px_0_rgba(15,23,42,0.02)]',
                        status === 'force_on' &&
                          'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)] shadow-[0_1px_0_rgba(15,23,42,0.02)]'
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
                            status === 'none' && 'text-muted-foreground',
                            status === 'force_on' && 'text-[var(--info-text)]/90',
                            status === 'force_off' && 'text-[var(--error-text)]/90'
                          )}
                        >
                          {monthRibbon}
                        </span>
                      ) : (
                        <span className="mb-0.5 h-[0.58rem]" aria-hidden />
                      )}
                      <span className="text-[1.2rem] font-bold leading-none tracking-[-0.03em]">
                        {new Date(`${date}T00:00:00`).getDate()}
                      </span>
                      <span className="mt-1.5 block max-w-full px-0.5 text-[0.62rem] font-semibold leading-snug">
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

        <div className="border-t border-border/70 px-5 py-5 sm:px-6">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Day Notes</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Add optional details for Need Off or Request to Work days.
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
