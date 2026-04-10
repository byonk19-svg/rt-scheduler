'use client'

import { useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { useAvailabilityPlannerFocus } from '@/components/availability/availability-planner-focus-context'

import {
  AvailabilityStatusSummary,
  type AvailabilityStatusSummaryRow,
} from '@/components/availability/AvailabilityStatusSummary'
import { AvailabilityCalendarPanel } from '@/components/availability/availability-calendar-panel'
import { AvailabilityWorkspaceShell } from '@/components/availability/availability-workspace-shell'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  splitPlannerDatesByMode,
  type PlannerMode,
  type PlannerOverrideRow,
} from '@/lib/availability-planner'
import { formatDateLabel, shiftMonthKey, toMonthStartKey } from '@/lib/calendar-utils'
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
  submittedRows: AvailabilityStatusSummaryRow[]
  missingRows: AvailabilityStatusSummaryRow[]
  saveManagerPlannerDatesAction: (formData: FormData) => void | Promise<void>
  deleteManagerPlannerDateAction: (formData: FormData) => void | Promise<void>
  copyAvailabilityFromPreviousCycleAction: (formData: FormData) => void | Promise<void>
  /** Renders beside the roster column on xl+ (e.g. Review requests table). */
  reviewRequestsPanel?: ReactNode
}

function employmentLabel(value: TherapistOption['employment_type']) {
  if (value === 'part_time') return 'Part-time'
  if (value === 'prn') return 'PRN'
  return 'Full-time'
}

function getModeCopy(mode: PlannerMode) {
  if (mode === 'will_work') {
    return 'Mark required dates first, then save the selected pattern for this therapist.'
  }
  return 'Blocked dates remain unavailable and should never be drafted into the schedule.'
}

function getSavedBucketsForSelection(
  overrides: PlannerOverrideRecord[],
  cycleId: string,
  therapistId: string
) {
  return splitPlannerDatesByMode(
    overrides.filter((row) => row.cycle_id === cycleId && row.therapist_id === therapistId),
    { source: 'manager' }
  )
}

export function ManagerSchedulingInputs({
  cycles,
  therapists,
  overrides,
  initialCycleId,
  initialTherapistId,
  submittedRows,
  missingRows,
  saveManagerPlannerDatesAction,
  deleteManagerPlannerDateAction,
  copyAvailabilityFromPreviousCycleAction,
  reviewRequestsPanel,
}: Props) {
  const plannerFocus = useAvailabilityPlannerFocus()

  const initialSelectedCycleId = initialCycleId || cycles[0]?.id || ''
  const initialSelectedTherapistId = initialTherapistId || therapists[0]?.id || ''

  const [selectedCycleId, setSelectedCycleId] = useState(initialSelectedCycleId)
  const [selectedTherapistId, setSelectedTherapistId] = useState(initialSelectedTherapistId)
  const [mode, setMode] = useState<PlannerMode>('will_work')
  const [selectedDates, setSelectedDates] = useState<string[]>(() => {
    const initialBuckets = getSavedBucketsForSelection(
      overrides,
      initialSelectedCycleId,
      initialSelectedTherapistId
    )
    return initialBuckets.willWork
  })
  const [monthStart, setMonthStart] = useState(() => {
    const cycle = cycles.find((item) => item.id === initialSelectedCycleId)
    return toMonthStartKey(cycle?.start_date ?? initialSelectedCycleId)
  })

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId]
  )
  const selectedTherapist = useMemo(
    () => therapists.find((therapist) => therapist.id === selectedTherapistId) ?? null,
    [selectedTherapistId, therapists]
  )

  useLayoutEffect(() => {
    plannerFocus?.setFocusedTherapistName(selectedTherapist?.full_name ?? null)
  }, [plannerFocus, selectedTherapist?.full_name])

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

  function syncSelection(nextMode: PlannerMode, cycleId: string, therapistId: string) {
    const nextBuckets = getSavedBucketsForSelection(overrides, cycleId, therapistId)
    setSelectedDates(nextMode === 'will_work' ? nextBuckets.willWork : nextBuckets.cannotWork)
  }

  function handleCycleChange(nextCycleId: string) {
    setSelectedCycleId(nextCycleId)
    const nextCycle = cycles.find((cycle) => cycle.id === nextCycleId)
    if (nextCycle) {
      setMonthStart(toMonthStartKey(nextCycle.start_date))
    }
    syncSelection(mode, nextCycleId, selectedTherapistId)
  }

  function handleTherapistChange(nextTherapistId: string) {
    setSelectedTherapistId(nextTherapistId)
    syncSelection(mode, selectedCycleId, nextTherapistId)
  }

  function handleModeChange(nextMode: PlannerMode) {
    setMode(nextMode)
    syncSelection(nextMode, selectedCycleId, selectedTherapistId)
  }

  function toggleDate(date: string) {
    if (!selectedCycle || !isDateWithinCycle(date, selectedCycle)) return
    setSelectedDates((current) =>
      current.includes(date)
        ? current.filter((value) => value !== date)
        : [...current, date].sort((a, b) => a.localeCompare(b))
    )
  }

  const statusByDate = useMemo(() => {
    const next: Record<string, 'selected' | 'saved' | 'blocked'> = {}
    for (const date of savedBuckets.willWork) next[date] = 'saved'
    for (const date of savedBuckets.cannotWork) next[date] = 'blocked'
    for (const date of selectedDates) next[date] = 'selected'
    return next
  }, [savedBuckets.cannotWork, savedBuckets.willWork, selectedDates])

  if (cycles.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-border/70 bg-card px-6 py-5">
        <h2 className="text-lg font-semibold text-foreground">Plan staffing</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a schedule cycle before planning hard staffing dates.
        </p>
      </section>
    )
  }

  if (therapists.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-border/70 bg-card px-6 py-5">
        <h2 className="text-lg font-semibold text-foreground">Plan staffing</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No active therapists are available to plan right now.
        </p>
      </section>
    )
  }

  return (
    <section id="staff-scheduling-inputs" className="space-y-6">
      <AvailabilityWorkspaceShell
        controls={
          <div className="space-y-5">
            <div className="space-y-1">
              <h2 className="app-section-title text-foreground">Plan staffing</h2>
              <p className="text-sm text-muted-foreground">{getModeCopy(mode)}</p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="planner_cycle_id"
                className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
              >
                Schedule cycle
              </Label>
              <select
                id="planner_cycle_id"
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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

            <div className="space-y-2">
              <Label
                htmlFor="planner_therapist_id"
                className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
              >
                Therapist
              </Label>
              <select
                id="planner_therapist_id"
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={selectedTherapistId}
                onChange={(event) => handleTherapistChange(event.target.value)}
              >
                {(['day', 'night'] as const).map((shiftType) => {
                  const group = therapists.filter((therapist) => therapist.shift_type === shiftType)
                  if (group.length === 0) return null

                  return (
                    <optgroup
                      key={shiftType}
                      label={shiftType === 'day' ? 'Day Shift' : 'Night Shift'}
                    >
                      {group.map((therapist) => (
                        <option key={therapist.id} value={therapist.id}>
                          {therapist.full_name}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </div>

            {selectedTherapist ? (
              <div
                className="space-y-3 rounded-xl border border-border bg-card px-3.5 py-3.5"
                role="group"
                aria-label="Therapist shift and employment (read-only)"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-medium">
                    {selectedTherapist.shift_type === 'night' ? 'Night shift' : 'Day shift'}
                  </Badge>
                  <Badge variant="outline" className="font-medium text-muted-foreground">
                    {employmentLabel(selectedTherapist.employment_type)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Planner inputs apply to {selectedTherapist.full_name}&apos;s normal shift
                  assignments.
                </p>
              </div>
            ) : null}

            {selectedCycleId && selectedTherapistId ? (
              <form action={copyAvailabilityFromPreviousCycleAction}>
                <input type="hidden" name="cycle_id" value={selectedCycleId} />
                <input type="hidden" name="therapist_id" value={selectedTherapistId} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  </svg>
                  Copy from last block
                </button>
              </form>
            ) : null}

            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Planner mode
              </p>
              <div className="inline-flex rounded-lg border border-border bg-card p-1">
                <button
                  type="button"
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                    mode === 'will_work'
                      ? 'bg-[var(--success-subtle)] text-[var(--success-text)]'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => handleModeChange('will_work')}
                >
                  Will work
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                    mode === 'cannot_work'
                      ? 'bg-[var(--error-subtle)] text-[var(--error-text)]'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => handleModeChange('cannot_work')}
                >
                  Cannot work
                </button>
              </div>
            </div>

            <form action={saveManagerPlannerDatesAction} className="space-y-3">
              <input type="hidden" name="cycle_id" value={selectedCycleId} />
              <input type="hidden" name="therapist_id" value={selectedTherapistId} />
              <input
                type="hidden"
                name="shift_type"
                value={selectedTherapist?.shift_type ?? 'day'}
              />
              <input type="hidden" name="mode" value={mode} />
              {selectedDates.map((date) => (
                <input key={`selected-date-${date}`} type="hidden" name="dates" value={date} />
              ))}

              <div className="space-y-3">
                <div className="min-h-16 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-3">
                  {selectedDates.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedDates.map((date) => (
                        <button
                          key={date}
                          type="button"
                          className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                          onClick={() =>
                            setSelectedDates((current) => current.filter((value) => value !== date))
                          }
                        >
                          {formatEmployeeDate(date)} x
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select dates on the calendar, then save this mode.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-border bg-card text-muted-foreground hover:bg-muted"
                  onClick={() => setSelectedDates([])}
                  disabled={selectedDates.length === 0}
                >
                  Clear selected
                </Button>
                <FormSubmitButton
                  type="submit"
                  pendingText="Saving..."
                  disabled={!selectedCycleId || !selectedTherapistId || selectedDates.length === 0}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Save {mode === 'will_work' ? 'Will work' : 'Cannot work'}
                </FormSubmitButton>
              </div>
            </form>
          </div>
        }
        calendar={
          <div className="space-y-5">
            <AvailabilityCalendarPanel
              monthStart={monthStart}
              cycleStart={selectedCycle?.start_date ?? monthStart}
              cycleEnd={selectedCycle?.end_date ?? monthStart}
              selectedDates={selectedDates}
              statusByDate={statusByDate}
              onPreviousMonth={() => setMonthStart((current) => shiftMonthKey(current, -1))}
              onNextMonth={() => setMonthStart((current) => shiftMonthKey(current, 1))}
              onToggleDate={toggleDate}
            />

            <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3">
              <Badge className="border-[var(--success-border)] bg-[var(--success-subtle)] font-medium text-[var(--success-text)]">
                Will work
              </Badge>
              <span className="text-sm text-muted-foreground">
                Required dates the draft should place when legal.
              </span>
              <Badge className="border-[var(--error-border)] bg-[var(--error-subtle)] font-medium text-[var(--error-text)]">
                Cannot work
              </Badge>
              <span className="text-sm text-muted-foreground">
                Blocked dates the draft must avoid.
              </span>
            </div>
          </div>
        }
        aside={
          <AvailabilityStatusSummary submittedRows={submittedRows} missingRows={missingRows} />
        }
        lower={
          <div className="rounded-[1.75rem] border border-border bg-card px-5 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Saved planner dates
            </p>
            {savedOverrides.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Saved manager planning dates for this therapist and cycle will appear here.
              </p>
            ) : (
              <div className="mt-4 max-h-[min(22rem,50vh)] overflow-y-auto overflow-x-hidden pr-1 [scrollbar-gutter:stable]">
                <div className="grid gap-3 lg:grid-cols-2">
                  {savedOverrides
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              row.override_type === 'force_on'
                                ? 'border-[var(--success-border)] text-[var(--success-text)]'
                                : 'border-[var(--error-border)] text-[var(--error-text)]'
                            )}
                          >
                            {row.override_type === 'force_on' ? 'Will work' : 'Cannot work'}
                          </Badge>
                          <span className="text-sm font-medium text-foreground">
                            {formatDateLabel(row.date)}
                          </span>
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
                            className="text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            Remove
                          </FormSubmitButton>
                        </form>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        }
        trailing={reviewRequestsPanel}
      />
    </section>
  )
}
