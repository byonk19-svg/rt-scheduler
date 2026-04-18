'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { useAvailabilityPlannerFocus } from '@/components/availability/availability-planner-focus-context'
import type {
  AvailabilityRosterFilter,
  AvailabilityStatusSummaryRow,
} from '@/components/availability/AvailabilityStatusSummary'
import { AvailabilityWorkspaceShell } from '@/components/availability/availability-workspace-shell'
import {
  splitPlannerDatesByMode,
  type PlannerMode,
  type PlannerOverrideRow,
} from '@/lib/availability-planner'
import { formatHumanCycleRange, shiftMonthKey, toMonthStartKey } from '@/lib/calendar-utils'
import { isDateWithinCycle } from '@/lib/employee-directory'

const AvailabilityStatusSummary = dynamic(() =>
  import('@/components/availability/AvailabilityStatusSummary').then(
    (module) => module.AvailabilityStatusSummary ?? (() => null)
  )
)
const AvailabilityCalendarPanel = dynamic(() =>
  import('@/components/availability/availability-calendar-panel').then(
    (module) => module.AvailabilityCalendarPanel ?? (() => null)
  )
)
const AvailabilitySecondaryPanel = dynamic(() =>
  import('@/components/availability/availability-secondary-panel').then(
    (module) => module.AvailabilitySecondaryPanel ?? (() => null)
  )
)
const PlannerControlRail = dynamic(() =>
  import('@/components/availability/planner-control-rail').then(
    (module) => module.PlannerControlRail ?? (() => null)
  )
)
const TherapistContextPanel = dynamic(() =>
  import('@/components/availability/therapist-context-panel').then(
    (module) => module.TherapistContextPanel ?? (() => null)
  )
)

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

type AvailabilityEntryRow = {
  id: string
  therapistId: string
  cycleId: string
  date: string
  reason: string | null
  createdAt: string
  updatedAt?: string
  requestedBy: string
  entryType: 'force_off' | 'force_on'
}

type Props = {
  cycles: Cycle[]
  therapists: TherapistOption[]
  overrides: PlannerOverrideRecord[]
  availabilityEntries: AvailabilityEntryRow[]
  initialCycleId: string
  initialTherapistId: string
  submittedRows: AvailabilityStatusSummaryRow[]
  missingRows: AvailabilityStatusSummaryRow[]
  initialRosterFilter?: AvailabilityRosterFilter
  defaultSecondaryTab?: 'roster' | 'inbox'
  saveManagerPlannerDatesAction: (formData: FormData) => void | Promise<void>
  deleteManagerPlannerDateAction: (formData: FormData) => void | Promise<void>
  copyAvailabilityFromPreviousCycleAction: (formData: FormData) => void | Promise<void>
  reviewRequestsPanel?: ReactNode
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
  availabilityEntries,
  initialCycleId,
  initialTherapistId,
  submittedRows,
  missingRows,
  initialRosterFilter = 'missing',
  defaultSecondaryTab = 'roster',
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

  const savedOverrides = useMemo(
    () =>
      overrides
        .filter(
          (row) => row.cycle_id === selectedCycleId && row.therapist_id === selectedTherapistId
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [overrides, selectedCycleId, selectedTherapistId]
  )

  const savedBuckets = useMemo(
    () => splitPlannerDatesByMode(savedOverrides, { source: 'manager' }),
    [savedOverrides]
  )

  const therapistRequestRows = useMemo(
    () =>
      availabilityEntries.filter(
        (row) => row.cycleId === selectedCycleId && row.therapistId === selectedTherapistId
      ),
    [availabilityEntries, selectedCycleId, selectedTherapistId]
  )

  const rosterRow =
    submittedRows.find((row) => row.therapistId === selectedTherapistId) ??
    missingRows.find((row) => row.therapistId === selectedTherapistId) ??
    null

  const submissionStatus = rosterRow
    ? {
        submitted: submittedRows.some((row) => row.therapistId === selectedTherapistId),
        overridesCount: rosterRow.overridesCount,
        lastUpdatedAt: rosterRow.lastUpdatedAt,
      }
    : null

  function syncSelection(nextMode: PlannerMode, cycleId: string, therapistId: string) {
    const nextBuckets = getSavedBucketsForSelection(overrides, cycleId, therapistId)
    setSelectedDates(nextMode === 'will_work' ? nextBuckets.willWork : nextBuckets.cannotWork)
  }

  function replacePlannerQuery(nextCycleId: string, nextTherapistId: string) {
    if (typeof window === 'undefined') return
    const currentUrl = new URL(window.location.href)
    const params = new URLSearchParams(currentUrl.search)
    params.set('tab', 'planner')
    if (nextCycleId) params.set('cycle', nextCycleId)
    if (nextTherapistId) params.set('therapist', nextTherapistId)
    params.delete('search')
    const query = params.toString()
    window.location.assign(query ? `${currentUrl.pathname}?${query}` : currentUrl.pathname)
  }

  function handleCycleChange(nextCycleId: string) {
    setSelectedCycleId(nextCycleId)
    const nextCycle = cycles.find((cycle) => cycle.id === nextCycleId)
    if (nextCycle) {
      setMonthStart(toMonthStartKey(nextCycle.start_date))
    }
    syncSelection(mode, nextCycleId, selectedTherapistId)
    replacePlannerQuery(nextCycleId, selectedTherapistId)
  }

  function handleTherapistChange(nextTherapistId: string) {
    setSelectedTherapistId(nextTherapistId)
    const nextTherapist = therapists.find((therapist) => therapist.id === nextTherapistId) ?? null
    plannerFocus?.setFocusedTherapistName(nextTherapist?.full_name ?? null)
    syncSelection(mode, selectedCycleId, nextTherapistId)
    replacePlannerQuery(selectedCycleId, nextTherapistId)
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

  const dayStates = useMemo(() => {
    const next: Record<
      string,
      {
        draftSelection?: 'will_work' | 'cannot_work'
        savedPlanner?: 'will_work' | 'cannot_work'
        requestTypes?: Array<'need_off' | 'request_to_work'>
      }
    > = {}

    for (const date of savedBuckets.willWork) {
      next[date] = { ...(next[date] ?? {}), savedPlanner: 'will_work' }
    }
    for (const date of savedBuckets.cannotWork) {
      next[date] = { ...(next[date] ?? {}), savedPlanner: 'cannot_work' }
    }
    for (const date of selectedDates) {
      next[date] = { ...(next[date] ?? {}), draftSelection: mode }
    }
    for (const row of therapistRequestRows) {
      const current = next[row.date] ?? {}
      const requestType = row.entryType === 'force_off' ? 'need_off' : 'request_to_work'
      next[row.date] = {
        ...current,
        requestTypes: [...(current.requestTypes ?? []), requestType],
      }
    }

    return next
  }, [mode, savedBuckets.cannotWork, savedBuckets.willWork, selectedDates, therapistRequestRows])

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
    <section id="staff-scheduling-inputs" className="space-y-3">
      <AvailabilityWorkspaceShell
        primaryHeader={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Planning workspace
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Plan staffing for the selected therapist inside the current schedule cycle.
              </p>
            </div>
          </div>
        }
        controls={
          <PlannerControlRail
            cycles={cycles}
            therapists={therapists}
            selectedCycleId={selectedCycleId}
            selectedTherapistId={selectedTherapistId}
            selectedTherapist={selectedTherapist}
            mode={mode}
            selectedDates={selectedDates}
            onCycleChange={handleCycleChange}
            onTherapistChange={handleTherapistChange}
            onModeChange={handleModeChange}
            onClearSelectedDates={() => setSelectedDates([])}
            onRemoveSelectedDate={(date) =>
              setSelectedDates((current) => current.filter((value) => value !== date))
            }
            copyAction={copyAvailabilityFromPreviousCycleAction}
            saveAction={saveManagerPlannerDatesAction}
          />
        }
        calendar={
          <AvailabilityCalendarPanel
            monthStart={monthStart}
            cycleStart={selectedCycle?.start_date ?? monthStart}
            cycleEnd={selectedCycle?.end_date ?? monthStart}
            selectedTherapistName={selectedTherapist?.full_name ?? 'Select a therapist'}
            cycleLabel={
              selectedCycle
                ? formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)
                : ''
            }
            dayStates={dayStates}
            onPreviousMonth={() => setMonthStart((current) => shiftMonthKey(current, -1))}
            onNextMonth={() => setMonthStart((current) => shiftMonthKey(current, 1))}
            onToggleDate={toggleDate}
          />
        }
        context={
          <TherapistContextPanel
            therapist={selectedTherapist}
            cycleLabel={
              selectedCycle
                ? formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)
                : 'No cycle selected'
            }
            requestRows={therapistRequestRows}
            savedPlannerRows={savedOverrides}
            submissionStatus={submissionStatus}
            deleteManagerPlannerDateAction={deleteManagerPlannerDateAction}
            selectedCycleId={selectedCycleId}
            selectedTherapistId={selectedTherapistId}
          />
        }
        secondaryContent={
          <AvailabilitySecondaryPanel
            defaultTab={defaultSecondaryTab}
            roster={
              <AvailabilityStatusSummary
                submittedRows={submittedRows}
                missingRows={missingRows}
                initialFilter={initialRosterFilter}
                onPickTherapist={handleTherapistChange}
                embedded
              />
            }
            inbox={reviewRequestsPanel}
          />
        }
      />
    </section>
  )
}
