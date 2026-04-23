import {
  buildManagerOverrideInput,
  isDateWithinCycle,
  type AvailabilityOverrideSource,
} from '@/lib/employee-directory'
import { isAllowedByPattern, isWeekendOn, type WorkPattern } from '@/lib/coverage/work-patterns'

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

export type PlannerDisplayRow = PlannerOverrideRow & {
  removable?: boolean
  derivedFromPattern?: boolean
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
      removable?: boolean
      derivedFromPattern?: boolean
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
  overrides: PlannerDisplayRow[],
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
      removable?: boolean
      derivedFromPattern?: boolean
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
      removable: row.removable,
      derivedFromPattern: row.derivedFromPattern,
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

function addUtcDay(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`)
  parsed.setDate(parsed.getDate() + 1)
  return parsed.toISOString().slice(0, 10)
}

function getWeekdayIndex(isoDate: string): number | null {
  const parsed = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getDay()
}

export function buildPlannerDefaultRowsForCycle(params: {
  therapistId: string
  cycle: { start_date: string; end_date: string } | null
  pattern: WorkPattern | null
}): PlannerDisplayRow[] {
  if (!params.cycle || !params.pattern) return []

  const rows: PlannerDisplayRow[] = []
  let cursor = params.cycle.start_date

  while (cursor <= params.cycle.end_date) {
    const weekday = getWeekdayIndex(cursor)
    const decision = isAllowedByPattern(params.pattern, cursor)
    const isAlternatingOnWeekend =
      (weekday === 0 || weekday === 6) &&
      params.pattern.weekend_rotation === 'every_other' &&
      isWeekendOn(params.pattern, cursor)

    if (decision.reason === 'blocked_offs_dow') {
      rows.push({
        id: `pattern-off:${params.therapistId}:${cursor}`,
        date: cursor,
        shift_type: 'both',
        override_type: 'force_off',
        note: 'Weekly pattern default: never works this weekday',
        source: 'manager',
        removable: false,
        derivedFromPattern: true,
      })
    } else if (isAlternatingOnWeekend) {
      rows.push({
        id: `pattern-on:${params.therapistId}:${cursor}`,
        date: cursor,
        shift_type: 'both',
        override_type: 'force_on',
        note: 'Weekly pattern default: alternating weekend on',
        source: 'manager',
        removable: false,
        derivedFromPattern: true,
      })
    } else if (weekday !== null && params.pattern.works_dow.includes(weekday)) {
      rows.push({
        id: `pattern-on:${params.therapistId}:${cursor}`,
        date: cursor,
        shift_type: 'both',
        override_type: 'force_on',
        note: 'Weekly pattern default: usually works this weekday',
        source: 'manager',
        removable: false,
        derivedFromPattern: true,
      })
    }

    cursor = addUtcDay(cursor)
  }

  return rows
}

export function mergePlannerRowsWithDefaults(
  explicitRows: PlannerDisplayRow[],
  defaultRows: PlannerDisplayRow[]
): PlannerDisplayRow[] {
  const explicitDates = new Set(explicitRows.map((row) => row.date))
  return [...explicitRows, ...defaultRows.filter((row) => !explicitDates.has(row.date))].sort(
    (a, b) => a.date.localeCompare(b.date)
  )
}
