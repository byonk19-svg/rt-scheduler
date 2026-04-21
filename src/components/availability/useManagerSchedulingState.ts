'use client'

import { useMemo, useState } from 'react'

import { useAvailabilityPlannerFocus } from '@/components/availability/availability-planner-focus-context'
import {
  buildDayStates,
  getCycleLabel,
  getPlannerRowsForSelection,
  getSavedBucketsForSelection,
  type ManagerAvailabilityEntryRow,
  type ManagerPlannerOverrideRecord,
} from '@/components/availability/manager-scheduling-helpers'
import type { AvailabilityStatusSummaryRow } from '@/components/availability/AvailabilityStatusSummary'
import { type PlannerMode } from '@/lib/availability-planner'
import { toMonthStartKey } from '@/lib/calendar-utils'
import type { WorkPattern } from '@/lib/coverage/work-patterns'
import { isDateWithinCycle } from '@/lib/employee-directory'

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

export function useManagerSchedulingState({
  availabilityEntries,
  cycles,
  initialCycleId,
  initialTherapistId,
  missingRows,
  overrides,
  submittedRows,
  therapists,
  workPatternsByTherapist,
}: {
  availabilityEntries: ManagerAvailabilityEntryRow[]
  cycles: Cycle[]
  initialCycleId: string
  initialTherapistId: string
  missingRows: AvailabilityStatusSummaryRow[]
  overrides: ManagerPlannerOverrideRecord[]
  submittedRows: AvailabilityStatusSummaryRow[]
  therapists: TherapistOption[]
  workPatternsByTherapist: Record<string, WorkPattern | null | undefined>
}) {
  const plannerFocus = useAvailabilityPlannerFocus()

  const initialSelectedCycleId = initialCycleId || cycles[0]?.id || ''
  const initialSelectedTherapistId = initialTherapistId || therapists[0]?.id || ''

  const [selectedCycleId, setSelectedCycleId] = useState(initialSelectedCycleId)
  const [selectedTherapistId, setSelectedTherapistId] = useState(initialSelectedTherapistId)
  const [mode, setMode] = useState<PlannerMode>('will_work')
  const [selectedDates, setSelectedDates] = useState<string[]>(() => {
    const initialCycle = cycles.find((item) => item.id === initialSelectedCycleId) ?? null
    const initialBuckets = getSavedBucketsForSelection(
      overrides,
      initialSelectedCycleId,
      initialSelectedTherapistId,
      {
        cycle: initialCycle,
        workPattern: workPatternsByTherapist[initialSelectedTherapistId] ?? null,
      }
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
  const selectedWorkPattern = useMemo(
    () => workPatternsByTherapist[selectedTherapistId] ?? null,
    [selectedTherapistId, workPatternsByTherapist]
  )

  const savedOverrides = useMemo(
    () =>
      getPlannerRowsForSelection(overrides, selectedCycleId, selectedTherapistId, {
        cycle: selectedCycle,
        workPattern: selectedWorkPattern,
      }),
    [overrides, selectedCycle, selectedCycleId, selectedTherapistId, selectedWorkPattern]
  )

  const savedBuckets = useMemo(
    () =>
      getSavedBucketsForSelection(overrides, selectedCycleId, selectedTherapistId, {
        cycle: selectedCycle,
        workPattern: selectedWorkPattern,
      }),
    [overrides, selectedCycle, selectedCycleId, selectedTherapistId, selectedWorkPattern]
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
    const nextCycle = cycles.find((cycle) => cycle.id === cycleId) ?? null
    const nextBuckets = getSavedBucketsForSelection(overrides, cycleId, therapistId, {
      cycle: nextCycle,
      workPattern: workPatternsByTherapist[therapistId] ?? null,
    })
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

  const dayStates = useMemo(
    () =>
      buildDayStates({
        savedBuckets,
        selectedDates,
        mode,
        therapistRequestRows,
      }),
    [mode, savedBuckets, selectedDates, therapistRequestRows]
  )

  return {
    dayStates,
    handleCycleChange,
    handleModeChange,
    handleTherapistChange,
    mode,
    monthStart,
    savedOverrides,
    selectedCycle,
    selectedCycleId,
    selectedCycleLabel: getCycleLabel(selectedCycle),
    selectedDates,
    selectedTherapist,
    selectedTherapistId,
    setMonthStart,
    setSelectedDates,
    submissionStatus,
    therapistRequestRows,
    toggleDate,
  }
}
