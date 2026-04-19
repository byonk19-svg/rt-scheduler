import { formatHumanCycleRange } from '@/lib/calendar-utils'
import {
  buildPlannerDefaultRowsForCycle,
  mergePlannerRowsWithDefaults,
  splitPlannerDatesByMode,
  type ManagerPlannerDateBuckets,
  type PlannerMode,
  type PlannerDisplayRow,
} from '@/lib/availability-planner'
import type { WorkPattern } from '@/lib/coverage/work-patterns'

export type ManagerPlannerOverrideRecord = PlannerDisplayRow & {
  therapist_id: string
  cycle_id: string
}

export type ManagerAvailabilityEntryRow = {
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

type DayState = {
  draftSelection?: PlannerMode
  savedPlanner?: PlannerMode
  savedPlannerKind?: 'explicit' | 'weekly_default'
  savedPlannerBadge?: 'Work' | 'Never'
  requestTypes?: Array<'need_off' | 'request_to_work'>
}

export function getSavedBucketsForSelection(
  overrides: ManagerPlannerOverrideRecord[],
  cycleId: string,
  therapistId: string,
  options?: {
    cycle?: { start_date: string; end_date: string } | null
    workPattern?: WorkPattern | null
  }
) {
  return splitPlannerDatesByMode(
    getPlannerRowsForSelection(overrides, cycleId, therapistId, options),
    {
      source: 'manager',
    }
  )
}

export function getPlannerRowsForSelection(
  overrides: ManagerPlannerOverrideRecord[],
  cycleId: string,
  therapistId: string,
  options?: {
    cycle?: { start_date: string; end_date: string } | null
    workPattern?: WorkPattern | null
  }
) {
  const explicitRows = overrides.filter(
    (row) => row.cycle_id === cycleId && row.therapist_id === therapistId
  )
  const defaultRows = buildPlannerDefaultRowsForCycle({
    therapistId,
    cycle: options?.cycle ?? null,
    pattern: options?.workPattern ?? null,
  })

  return mergePlannerRowsWithDefaults(explicitRows, defaultRows)
}

export function buildDayStates(params: {
  savedBuckets: Pick<ManagerPlannerDateBuckets, 'willWork' | 'cannotWork' | 'byDate'>
  selectedDates: string[]
  mode: PlannerMode
  therapistRequestRows: ManagerAvailabilityEntryRow[]
}) {
  const next: Record<string, DayState> = {}

  for (const date of params.savedBuckets.willWork) {
    const rows = params.savedBuckets.byDate.get(date) ?? []
    const derived = rows.some((row) => row.derivedFromPattern)
    next[date] = {
      ...(next[date] ?? {}),
      savedPlanner: 'will_work',
      savedPlannerKind: derived ? 'weekly_default' : 'explicit',
      savedPlannerBadge: derived ? 'Work' : undefined,
    }
  }

  for (const date of params.savedBuckets.cannotWork) {
    const rows = params.savedBuckets.byDate.get(date) ?? []
    const derived = rows.some((row) => row.derivedFromPattern)
    next[date] = {
      ...(next[date] ?? {}),
      savedPlanner: 'cannot_work',
      savedPlannerKind: derived ? 'weekly_default' : 'explicit',
      savedPlannerBadge: derived ? 'Never' : undefined,
    }
  }

  for (const date of params.selectedDates) {
    next[date] = { ...(next[date] ?? {}), draftSelection: params.mode }
  }

  for (const row of params.therapistRequestRows) {
    const current = next[row.date] ?? {}
    const requestType = row.entryType === 'force_off' ? 'need_off' : 'request_to_work'
    next[row.date] = {
      ...current,
      requestTypes: [...(current.requestTypes ?? []), requestType],
    }
  }

  return next
}

export function getCycleLabel(
  cycle: { start_date: string; end_date: string } | null,
  fallback = ''
) {
  return cycle ? formatHumanCycleRange(cycle.start_date, cycle.end_date) : fallback
}
