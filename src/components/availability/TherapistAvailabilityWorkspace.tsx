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
  const [draftStatusByDate, setDraftStatusByDate] =
    useState<Record<string, DayStatus>>(initialStatusByDate)

  function handleCycleChange(nextCycleId: string) {
    setSelectedCycleId(nextCycleId)
    const nextRows = availabilityRows.filter((row) => row.cycleId === nextCycleId)
    const nextStatusByDate: Record<string, DayStatus> = {}
    for (const row of nextRows) {
      nextStatusByDate[row.date] = row.entryType === 'force_off' ? 'force_off' : 'force_on'
    }
    setDraftStatusByDate(nextStatusByDate)
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

  /** Days with no override — no preference for autodraft (pattern/eligibility only). */
  const noPreferenceCount = useMemo(() => {
    if (!selectedCycle) return 0
    return cycleDays.filter((date) => (draftStatusByDate[date] ?? 'none') === 'none').length
  }, [cycleDays, draftStatusByDate, selectedCycle])

  const mustWorkCount = canWorkDates.length

  function toggleDate(date: string) {
    if (!selectedCycle) return
    setDraftStatusByDate((current) => {
      const status = current[date] ?? 'none'
      // Default: available → unavailable → must work → available
      const next: DayStatus =
        status === 'none' ? 'force_off' : status === 'force_off' ? 'force_on' : 'none'
      const prev = { ...current }
      if (next === 'none') {
        delete prev[date]
        return prev
      }
      return { ...prev, [date]: next }
    })
  }

  if (cycles.length === 0) {
    return (
      <section
        id="therapist-availability-workspace"
        className="rounded-2xl border border-border bg-card px-6 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
      >
        <h2 className="text-lg font-semibold tracking-tight text-foreground">My availability</h2>
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
        {canWorkDates.map((date) => (
          <input key={`can-${date}`} type="hidden" name="can_work_dates" value={date} />
        ))}
        {cannotWorkDates.map((date) => (
          <input key={`cannot-${date}`} type="hidden" name="cannot_work_dates" value={date} />
        ))}

        <div className="flex flex-col gap-5 border-b border-border/80 px-5 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <h2 className="app-page-title text-foreground">My Availability</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {selectedCycle ? (
                <>
                  <span className="font-medium text-foreground">{selectedCycle.label}</span>
                  {cycleDateRangeLabel ? (
                    <>
                      <span className="text-border"> · </span>
                      Next cycle: {cycleDateRangeLabel}
                    </>
                  ) : null}
                  <span className="text-border"> · </span>
                  Tap a day to cycle through statuses.
                </>
              ) : (
                'Select a cycle to enter availability.'
              )}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.68rem] font-medium uppercase tracking-[0.07em] text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted ring-2 ring-border"
                  aria-hidden
                />
                Available
              </span>
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--error-subtle)] ring-2 ring-[var(--error-border)]/80"
                  aria-hidden
                />
                Unavailable
              </span>
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--success-subtle)] ring-2 ring-[var(--success-border)]/80"
                  aria-hidden
                />
                Must work
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
              pendingText="Saving…"
              className="h-10 shrink-0 gap-2 px-5 font-semibold shadow-sm sm:self-end"
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
              Submit
            </FormSubmitButton>
          </div>
        </div>

        <div className="border-b border-border/60 bg-muted/15 px-5 py-3 sm:px-6">
          <p className="text-right text-xs tabular-nums text-muted-foreground">
            <span className="font-semibold text-foreground">{noPreferenceCount}</span> no preference
            · <span className="font-semibold text-foreground">{cannotWorkDates.length}</span>{' '}
            unavailable · <span className="font-semibold text-foreground">{mustWorkCount}</span>{' '}
            must work
          </p>
        </div>

        <div className="border-b border-[var(--info-border)] bg-[var(--info-subtle)] px-5 py-3 sm:px-6">
          <p className="text-xs font-medium leading-relaxed text-[var(--info-text)]">
            Days default to <span className="font-semibold">no preference</span> (autodraft uses
            your usual pattern only). Tap to <span className="font-semibold">unavailable</span>,
            then <span className="font-semibold">must work</span> for a hard autodraft constraint
            (we try to schedule you that day), then back to no preference. Add a note below for
            unavailable days when needed.
          </p>
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
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => toggleDate(date)}
                      className={cn(
                        'flex min-h-[5.5rem] flex-col items-center justify-center rounded-[20px] border px-1 py-2 text-center shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-[border-color,box-shadow,transform,background-color] duration-200',
                        'hover:-translate-y-px focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                        status === 'none' &&
                          'border-border/80 bg-card text-foreground hover:border-primary/25 hover:shadow-[0_14px_28px_-22px_rgba(15,23,42,0.35)]',
                        status === 'force_on' &&
                          'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)] shadow-[0_1px_0_rgba(15,23,42,0.02)]',
                        status === 'force_off' &&
                          'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)] shadow-[0_1px_0_rgba(15,23,42,0.02)]'
                      )}
                      aria-label={`${formatDateLabel(date)}: ${
                        status === 'none'
                          ? 'Available'
                          : status === 'force_off'
                            ? 'Unavailable'
                            : 'Must work'
                      }`}
                    >
                      <span className="text-[1.2rem] font-bold leading-none tracking-[-0.03em]">
                        {new Date(`${date}T00:00:00`).getDate()}
                      </span>
                      <span className="mt-1.5 block max-w-full px-0.5 text-[0.62rem] font-semibold leading-snug">
                        {status === 'none'
                          ? 'No preference'
                          : status === 'force_off'
                            ? 'Unavailable'
                            : 'Must work'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </form>
    </section>
  )
}
