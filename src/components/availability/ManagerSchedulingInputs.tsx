'use client'

import { useMemo, useState } from 'react'

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
}: Props) {
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
        primaryHeader={
          <h2 className="inline-block border-b-2 border-[#2d5a5a] pb-3 text-sm font-bold text-[#2d5a5a]">
            Staffing Inputs &amp; Calendar
          </h2>
        }
        controls={
          <div className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-[-0.01em] text-slate-800">Plan staffing</h2>
              <p className="text-sm text-slate-500">{getModeCopy(mode)}</p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="planner_cycle_id"
                className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"
              >
                Schedule cycle
              </Label>
              <select
                id="planner_cycle_id"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#2d5a5a] focus:ring-2 focus:ring-[#2d5a5a]/15"
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
                className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"
              >
                Therapist
              </Label>
              <select
                id="planner_therapist_id"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#2d5a5a] focus:ring-2 focus:ring-[#2d5a5a]/15"
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
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700">
                    {selectedTherapist.shift_type === 'night' ? 'Night Shift' : 'Day Shift'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="relative inline-flex h-5 w-10 rounded-full bg-[#2d5a5a]">
                      <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-white" />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500">
                      {employmentLabel(selectedTherapist.employment_type)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-500">
                  Planner inputs apply to {selectedTherapist.full_name}&apos;s normal shift
                  assignments.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                Planner mode
              </p>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                    mode === 'will_work'
                      ? 'bg-[#4ade80]/20 text-[#237043]'
                      : 'text-slate-500 hover:text-slate-800'
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
                      ? 'bg-[#f87171]/20 text-[#b54444]'
                      : 'text-slate-500 hover:text-slate-800'
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
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-[#4ade80]" />
                    <span className="text-xs font-medium text-slate-600">Will work</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-[#f87171]" />
                    <span className="text-xs font-medium text-slate-600">Cannot work</span>
                  </div>
                </div>
                <div className="min-h-16 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3">
                  {selectedDates.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedDates.map((date) => (
                        <button
                          key={date}
                          type="button"
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          onClick={() =>
                            setSelectedDates((current) => current.filter((value) => value !== date))
                          }
                        >
                          {formatEmployeeDate(date)} x
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Select dates on the calendar, then save this mode.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  onClick={() => setSelectedDates([])}
                  disabled={selectedDates.length === 0}
                >
                  Clear selected
                </Button>
                <FormSubmitButton
                  type="submit"
                  pendingText="Saving..."
                  disabled={!selectedCycleId || !selectedTherapistId || selectedDates.length === 0}
                  className="bg-[#2d5a5a] text-white hover:bg-[#244a4a]"
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

            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
              <Badge className="bg-[#4ade80] text-white">Will work</Badge>
              <span className="text-sm text-slate-500">
                Required dates the draft should place when legal.
              </span>
              <Badge className="bg-[#f87171] text-white">Cannot work</Badge>
              <span className="text-sm text-slate-500">Blocked dates the draft must avoid.</span>
            </div>
          </div>
        }
        aside={
          <AvailabilityStatusSummary submittedRows={submittedRows} missingRows={missingRows} />
        }
        lower={
          <div className="rounded-[1.75rem] border border-slate-200/90 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
              Saved planner dates
            </p>
            {savedOverrides.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Saved manager planning dates for this therapist and cycle will appear here.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {savedOverrides
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            row.override_type === 'force_on'
                              ? 'border-[#4ade80] text-[#237043]'
                              : 'border-[#f87171] text-[#b54444]'
                          )}
                        >
                          {row.override_type === 'force_on' ? 'Will work' : 'Cannot work'}
                        </Badge>
                        <span className="text-sm font-medium text-slate-700">
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
                          className="text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        >
                          Remove
                        </FormSubmitButton>
                      </form>
                    </div>
                  ))}
              </div>
            )}
          </div>
        }
      />
    </section>
  )
}
