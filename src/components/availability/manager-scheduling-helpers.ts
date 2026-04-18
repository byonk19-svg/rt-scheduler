import { formatHumanCycleRange } from '@/lib/calendar-utils'
import {
  splitPlannerDatesByMode,
  type ManagerPlannerDateBuckets,
  type PlannerMode,
  type PlannerOverrideRow,
} from '@/lib/availability-planner'

export type ManagerPlannerOverrideRecord = PlannerOverrideRow & {
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
  requestTypes?: Array<'need_off' | 'request_to_work'>
}

export function getSavedBucketsForSelection(
  overrides: ManagerPlannerOverrideRecord[],
  cycleId: string,
  therapistId: string
) {
  return splitPlannerDatesByMode(
    overrides.filter((row) => row.cycle_id === cycleId && row.therapist_id === therapistId),
    { source: 'manager' }
  )
}

export function buildDayStates(params: {
  savedBuckets: Pick<ManagerPlannerDateBuckets, 'willWork' | 'cannotWork'>
  selectedDates: string[]
  mode: PlannerMode
  therapistRequestRows: ManagerAvailabilityEntryRow[]
}) {
  const next: Record<string, DayState> = {}

  for (const date of params.savedBuckets.willWork) {
    next[date] = { ...(next[date] ?? {}), savedPlanner: 'will_work' }
  }

  for (const date of params.savedBuckets.cannotWork) {
    next[date] = { ...(next[date] ?? {}), savedPlanner: 'cannot_work' }
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
