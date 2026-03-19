import {
  buildManagerOverrideInput,
  isDateWithinCycle,
  type AvailabilityOverrideSource,
} from '@/lib/employee-directory'

export type PlannerOverrideType = 'force_on' | 'force_off'
export type PlannerMode = 'will_work' | 'cannot_work'
export type PlannerShiftType = 'day' | 'night' | 'both'

export type PlannerOverrideRow = {
  id: string
  date: string
  shift_type: PlannerShiftType
  override_type: PlannerOverrideType
  note: string | null
  source: AvailabilityOverrideSource
}

export type ManagerPlannerDateBuckets = {
  willWork: string[]
  cannotWork: string[]
  byDate: Map<
    string,
    Array<{
      id: string
      mode: PlannerMode
      shiftType: PlannerShiftType
      note: string | null
      source: AvailabilityOverrideSource
    }>
  >
}

export function toPlannerMode(overrideType: PlannerOverrideType): PlannerMode {
  return overrideType === 'force_on' ? 'will_work' : 'cannot_work'
}

export function toOverrideType(mode: PlannerMode): PlannerOverrideType {
  return mode === 'will_work' ? 'force_on' : 'force_off'
}

export function splitPlannerDatesByMode(
  overrides: PlannerOverrideRow[],
  options?: { source?: AvailabilityOverrideSource }
): ManagerPlannerDateBuckets {
  const willWork = new Set<string>()
  const cannotWork = new Set<string>()
  const byDate = new Map<
    string,
    Array<{
      id: string
      mode: PlannerMode
      shiftType: PlannerShiftType
      note: string | null
      source: AvailabilityOverrideSource
    }>
  >()

  for (const row of overrides) {
    if (options?.source && row.source !== options.source) continue

    const mode = toPlannerMode(row.override_type)
    if (mode === 'will_work') {
      willWork.add(row.date)
    } else {
      cannotWork.add(row.date)
    }

    const existing = byDate.get(row.date) ?? []
    existing.push({
      id: row.id,
      mode,
      shiftType: row.shift_type,
      note: row.note,
      source: row.source,
    })
    byDate.set(row.date, existing)
  }

  return {
    willWork: [...willWork].sort((a, b) => a.localeCompare(b)),
    cannotWork: [...cannotWork].sort((a, b) => a.localeCompare(b)),
    byDate,
  }
}

export function hasDuplicatePlannerDates(dates: string[]): boolean {
  return new Set(dates).size !== dates.length
}

export function getPlannerDateValidationError(params: {
  cycle: { start_date: string; end_date: string } | null
  therapistId: string
  dates: string[]
}): string | null {
  if (!params.cycle) return 'Select a schedule cycle first.'
  if (!params.therapistId) return 'Select a therapist first.'
  if (params.dates.length === 0) return 'Select at least one date.'
  if (hasDuplicatePlannerDates(params.dates)) {
    return 'Date selections must be unique before saving.'
  }

  const outsideCycle = params.dates.find((date) => !isDateWithinCycle(date, params.cycle))
  if (outsideCycle) {
    return 'All selected dates must fall within the chosen cycle.'
  }

  return null
}

export function buildPlannerSavePayload(params: {
  cycleId: string
  therapistId: string
  shiftType: PlannerShiftType
  mode: PlannerMode
  dates: string[]
  note?: string | null
  managerId: string
}) {
  const uniqueDates = [...new Set(params.dates)].sort((a, b) => a.localeCompare(b))

  return uniqueDates.map((date) =>
    buildManagerOverrideInput({
      cycleId: params.cycleId,
      therapistId: params.therapistId,
      date,
      shiftType: params.shiftType,
      overrideType: toOverrideType(params.mode),
      note: params.note ?? null,
      managerId: params.managerId,
    })
  )
}
