'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { FormSubmitButton } from '@/components/form-submit-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  splitPlannerDatesByMode,
  type PlannerMode,
  type PlannerOverrideRow,
} from '@/lib/availability-planner'
import {
  buildCalendarWeeks,
  formatMonthLabel,
  shiftMonthKey,
  toIsoDate,
  toMonthEndKey,
  toMonthStartKey,
} from '@/lib/calendar-utils'
import { formatEmployeeDate, isDateWithinCycle } from '@/lib/employee-directory'
import { cn } from '@/lib/utils'

type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
}

type TherapistOption = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  employment_type: 'full_time' | 'part_time' | 'prn'
}

type PlannerOverrideRecord = PlannerOverrideRow & {
  therapist_id: string
  cycle_id: string
}

type Props = {
  cycles: Cycle[]
  therapists: TherapistOption[]
  overrides: PlannerOverrideRecord[]
  initialCycleId: string
  initialTherapistId: string
  saveManagerPlannerDatesAction: (formData: FormData) => void | Promise<void>
  deleteManagerPlannerDateAction: (formData: FormData) => void | Promise<void>
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function employmentLabel(value: TherapistOption['employment_type']) {
  if (value === 'part_time') return 'Part-time'
  if (value === 'prn') return 'PRN'
  return 'Full-time'
}

function getModeCopy(mode: PlannerMode) {
  if (mode === 'will_work') {
    return 'Will work dates are forced into auto-draft when a legal slot exists.'
  }
  return 'Cannot work dates are hard blocks that auto-draft must never assign.'
}

export function ManagerSchedulingInputs({
  cycles,
  therapists,
  overrides,
  initialCycleId,
  initialTherapistId,
  saveManagerPlannerDatesAction,
  deleteManagerPlannerDateAction,
}: Props) {
  const [selectedCycleId, setSelectedCycleId] = useState(initialCycleId || cycles[0]?.id || '')
  const [selectedTherapistId, setSelectedTherapistId] = useState(
    initialTherapistId || therapists[0]?.id || ''
  )
  const [mode, setMode] = useState<PlannerMode>('will_work')
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [monthStart, setMonthStart] = useState(() => {
    const cycle = cycles.find((item) => item.id === (initialCycleId || cycles[0]?.id))
    return toMonthStartKey(cycle?.start_date ?? toIsoDate(new Date()))
  })

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId]
  )
  const selectedTherapist = useMemo(
    () => therapists.find((therapist) => therapist.id === selectedTherapistId) ?? null,
    [selectedTherapistId, therapists]
  )

  const savedOverrides = useMemo(
    () =>
      overrides.filter(
        (row) => row.cycle_id === selectedCycleId && row.therapist_id === selectedTherapistId
      ),
    [overrides, selectedCycleId, selectedTherapistId]
  )

  const savedBuckets = useMemo(
    () => splitPlannerDatesByMode(savedOverrides, { source: 'manager' }),
    [savedOverrides]
  )

  useEffect(() => {
    setSelectedDates(mode === 'will_work' ? savedBuckets.willWork : savedBuckets.cannotWork)
  }, [mode, savedBuckets.cannotWork, savedBuckets.willWork])

  useEffect(() => {
    if (selectedCycle) {
      setMonthStart(toMonthStartKey(selectedCycle.start_date))
    }
  }, [selectedCycle])

  const monthKey = monthStart.slice(0, 7)
  const calendarWeeks = useMemo(
    () => buildCalendarWeeks(monthStart, toMonthEndKey(monthStart)),
    [monthStart]
  )
  const selectedDateSet = useMemo(() => new Set(selectedDates), [selectedDates])

  const canGoPrevMonth = useMemo(() => {
    if (!selectedCycle) return false
    const prevMonthEnd = toMonthEndKey(shiftMonthKey(monthStart, -1))
    return prevMonthEnd >= selectedCycle.start_date
  }, [monthStart, selectedCycle])

  const canGoNextMonth = useMemo(() => {
    if (!selectedCycle) return false
    const nextMonthStart = shiftMonthKey(monthStart, 1)
    return nextMonthStart <= selectedCycle.end_date
  }, [monthStart, selectedCycle])

  function toggleDate(date: string) {
    if (!selectedCycle || !isDateWithinCycle(date, selectedCycle)) return
    setSelectedDates((current) =>
      current.includes(date)
        ? current.filter((value) => value !== date)
        : [...current, date].sort((a, b) => a.localeCompare(b))
    )
  }

  if (cycles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan staffing</CardTitle>
          <CardDescription>
            Create a schedule cycle before planning hard staffing dates.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (therapists.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan staffing</CardTitle>
          <CardDescription>No active therapists are available to plan right now.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card id="staff-scheduling-inputs" className="border-border/70 bg-card/85 shadow-none">
      <CardHeader className="border-b border-border/60 bg-muted/15 pb-4">
        <CardTitle>Plan staffing</CardTitle>
        <CardDescription>
          Set hard dates that auto-draft must honor. Use <strong>Will work</strong> for required
          days and <strong>Cannot work</strong> for blocked days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="planner_cycle_id">Schedule cycle</Label>
            <select
              id="planner_cycle_id"
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={selectedCycleId}
              onChange={(event) => setSelectedCycleId(event.target.value)}
            >
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.label} ({cycle.start_date} to {cycle.end_date})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="planner_therapist_id">Therapist</Label>
            <select
              id="planner_therapist_id"
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={selectedTherapistId}
              onChange={(event) => setSelectedTherapistId(event.target.value)}
            >
              {therapists.map((therapist) => (
                <option key={therapist.id} value={therapist.id}>
                  {therapist.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedTherapist && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
            <Badge variant="outline" className="capitalize">
              {selectedTherapist.shift_type} shift
            </Badge>
            <Badge variant="outline">{employmentLabel(selectedTherapist.employment_type)}</Badge>
            <p className="text-sm text-muted-foreground">
              Planner inputs apply to {selectedTherapist.full_name}&apos;s normal shift assignments.
            </p>
          </div>
        )}

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Planner mode
              </p>
              <p className="text-sm text-muted-foreground">{getModeCopy(mode)}</p>
            </div>
            <div className="inline-flex rounded-lg border border-border bg-card p-1">
              <button
                type="button"
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  mode === 'will_work'
                    ? 'bg-[var(--success-subtle)] text-[var(--success-text)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setMode('will_work')}
              >
                Will work
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  mode === 'cannot_work'
                    ? 'bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setMode('cannot_work')}
              >
                Cannot work
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/90 p-3">
            <div className="mb-3 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canGoPrevMonth}
                onClick={() => setMonthStart((current) => shiftMonthKey(current, -1))}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="text-sm font-semibold">{formatMonthLabel(monthStart)}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canGoNextMonth}
                onClick={() => setMonthStart((current) => shiftMonthKey(current, 1))}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="mb-2 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((day) => (
                <p
                  key={day}
                  className="text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground"
                >
                  {day}
                </p>
              ))}
            </div>
            <div className="space-y-1">
              {calendarWeeks.map((week, weekIndex) => (
                <div key={`planner-week-${weekIndex}`} className="grid grid-cols-7 gap-1">
                  {week.map((day) => {
                    const dayKey = toIsoDate(day)
                    const isCurrentMonth = dayKey.slice(0, 7) === monthKey
                    const isInCycle = isDateWithinCycle(dayKey, selectedCycle)
                    const isSelected = selectedDateSet.has(dayKey)
                    return (
                      <button
                        key={dayKey}
                        type="button"
                        onClick={() => toggleDate(dayKey)}
                        disabled={!isInCycle}
                        className={cn(
                          'h-9 rounded-md text-sm transition-colors',
                          isSelected &&
                            mode === 'will_work' &&
                            'bg-[var(--success-subtle)] text-[var(--success-text)]',
                          isSelected &&
                            mode === 'cannot_work' &&
                            'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
                          !isSelected && isInCycle && 'hover:bg-secondary',
                          !isCurrentMonth && !isSelected && 'text-muted-foreground',
                          !isInCycle && 'cursor-not-allowed opacity-35'
                        )}
                      >
                        {day.getDate()}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <form action={saveManagerPlannerDatesAction} className="space-y-3">
            <input type="hidden" name="cycle_id" value={selectedCycleId} />
            <input type="hidden" name="therapist_id" value={selectedTherapistId} />
            <input type="hidden" name="shift_type" value={selectedTherapist?.shift_type ?? 'day'} />
            <input type="hidden" name="mode" value={mode} />
            {selectedDates.map((date) => (
              <input key={`selected-date-${date}`} type="hidden" name="dates" value={date} />
            ))}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {selectedDates.length > 0 ? (
                  selectedDates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-secondary"
                      onClick={() =>
                        setSelectedDates((current) => current.filter((value) => value !== date))
                      }
                    >
                      {formatEmployeeDate(date)} x
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Pick dates on the calendar, then save this mode.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedDates([])}
                  disabled={selectedDates.length === 0}
                >
                  Clear selected
                </Button>
                <FormSubmitButton
                  type="submit"
                  pendingText="Saving..."
                  disabled={!selectedCycleId || !selectedTherapistId || selectedDates.length === 0}
                >
                  Save {mode === 'will_work' ? 'Will work' : 'Cannot work'}
                </FormSubmitButton>
              </div>
            </div>
          </form>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--success-border)] bg-[var(--success-subtle)]/45 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--success-text)]">
              Will work
            </p>
            {savedBuckets.willWork.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--success-text)]/80">
                No required work dates saved yet.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {savedBuckets.willWork.map((date) => (
                  <Badge key={`will-work-${date}`} className="bg-[var(--success-text)] text-white">
                    {formatEmployeeDate(date)}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-subtle)]/45 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--warning-text)]">
              Cannot work
            </p>
            {savedBuckets.cannotWork.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--warning-text)]/80">
                No blocked dates saved yet.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {savedBuckets.cannotWork.map((date) => (
                  <Badge
                    key={`cannot-work-${date}`}
                    className="bg-[var(--warning-text)] text-white"
                  >
                    {formatEmployeeDate(date)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Remove saved dates
          </p>
          {savedOverrides.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Saved manager planning dates for this therapist and cycle will appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {savedOverrides
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          row.override_type === 'force_on'
                            ? 'border-[var(--success-border)] text-[var(--success-text)]'
                            : 'border-[var(--warning-border)] text-[var(--warning-text)]'
                        )}
                      >
                        {row.override_type === 'force_on' ? 'Will work' : 'Cannot work'}
                      </Badge>
                      <span className="text-sm font-medium">{formatEmployeeDate(row.date)}</span>
                    </div>
                    <form action={deleteManagerPlannerDateAction}>
                      <input type="hidden" name="override_id" value={row.id} />
                      <input type="hidden" name="cycle_id" value={selectedCycleId} />
                      <input type="hidden" name="therapist_id" value={selectedTherapistId} />
                      <FormSubmitButton
                        type="submit"
                        variant="ghost"
                        size="sm"
                        pendingText="Removing..."
                      >
                        Remove
                      </FormSubmitButton>
                    </form>
                  </div>
                ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
