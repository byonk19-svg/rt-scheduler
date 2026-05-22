import { addDays, dateFromKey, formatHumanCycleRange, toIsoDate } from '@/lib/calendar-utils'

const SCHEDULE_BLOCK_DAY_COUNT = 42

const MS_PER_DAY = 24 * 60 * 60 * 1000

export type ScheduleBlockPlanningCycle = {
  id: string
  label?: string | null
  start_date: string
  end_date: string
  archived_at?: string | null
  published?: boolean | null
  status?: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
  availability_due_at?: string | null
}

export type SuggestedScheduleBlock = {
  startDate: string
  endDate: string
  label: string
}

export type SuggestedPlanningDates = {
  availabilityDueDate: string
  preliminaryTargetDate: string
  finalPublishTargetDate: string
}

export type ScheduleBlockPlanningInput = {
  startDate: string
  endDate: string
  availabilityDueDate: string | null
  preliminaryTargetDate?: string | null
  finalPublishTargetDate?: string | null
  wasTherapistVisible?: boolean
}

export type ScheduleBlockPlanningValidation = {
  valid: boolean
  errors: string[]
  warnings: string[]
}

function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = dateFromKey(value)
  if (Number.isNaN(parsed.getTime())) return null
  if (toIsoDate(parsed) !== value) return null
  return parsed
}

function compareDateKeys(left: string, right: string): number {
  return left.localeCompare(right)
}

function isSundayToSixWeekSaturdayRange(startDate: string, endDate: string): boolean {
  const start = parseDateKey(startDate)
  const end = parseDateKey(endDate)
  if (!start || !end) return false

  const inclusiveDays = (end.getTime() - start.getTime()) / MS_PER_DAY + 1
  return start.getDay() === 0 && inclusiveDays === SCHEDULE_BLOCK_DAY_COUNT
}

function hasDateOverlap(
  candidate: Pick<ScheduleBlockPlanningCycle, 'start_date' | 'end_date'>,
  startDate: string,
  endDate: string
): boolean {
  return candidate.start_date <= endDate && candidate.end_date >= startDate
}

function nextSundayAfter(dateKey: string): string {
  const parsed = parseDateKey(dateKey)
  if (!parsed) return dateKey
  const next = addDays(parsed, 1)
  while (next.getDay() !== 0) {
    next.setDate(next.getDate() + 1)
  }
  return toIsoDate(next)
}

export function buildScheduleBlockLabel(startDate: string, endDate: string): string {
  return formatHumanCycleRange(startDate, endDate)
}

export function suggestNextScheduleBlock(
  existingCycles: ScheduleBlockPlanningCycle[]
): SuggestedScheduleBlock | null {
  const latest = existingCycles
    .filter((cycle) => !cycle.archived_at && cycle.status !== 'archived')
    .sort((a, b) => b.end_date.localeCompare(a.end_date))[0]

  if (!latest) return null

  const startDate = nextSundayAfter(latest.end_date)
  const endDate = toIsoDate(addDays(dateFromKey(startDate), SCHEDULE_BLOCK_DAY_COUNT - 1))
  return {
    startDate,
    endDate,
    label: buildScheduleBlockLabel(startDate, endDate),
  }
}

export function suggestPlanningDates(startDate: string): SuggestedPlanningDates {
  const start = dateFromKey(startDate)
  return {
    availabilityDueDate: toIsoDate(addDays(start, -21)),
    preliminaryTargetDate: toIsoDate(addDays(start, -14)),
    finalPublishTargetDate: toIsoDate(addDays(start, -7)),
  }
}

export function normalizeAvailabilityDueDate(dateKey: string): string | null {
  const parsed = parseDateKey(dateKey)
  if (!parsed) return null
  parsed.setHours(23, 59, 59, 999)
  return parsed.toISOString()
}

export function availabilityDueDateKey(value: string | null | undefined): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return toIsoDate(parsed)
  return /^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10)) ? value.slice(0, 10) : null
}

export function validateScheduleBlockPlanning(
  input: ScheduleBlockPlanningInput,
  existingCycles: ScheduleBlockPlanningCycle[],
  currentCycleId?: string
): ScheduleBlockPlanningValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!parseDateKey(input.startDate) || !parseDateKey(input.endDate)) {
    errors.push('invalid_date')
  } else if (compareDateKeys(input.endDate, input.startDate) < 0) {
    errors.push('invalid_range')
  } else if (!isSundayToSixWeekSaturdayRange(input.startDate, input.endDate)) {
    errors.push('invalid_block_shape')
  }

  if (input.wasTherapistVisible && !input.availabilityDueDate) {
    errors.push('visible_due_date_required')
  }

  const availabilityDueDate = input.availabilityDueDate?.trim() || null
  const preliminaryTargetDate = input.preliminaryTargetDate?.trim() || null
  const finalPublishTargetDate = input.finalPublishTargetDate?.trim() || null

  for (const [field, value] of [
    ['availability_due_date', availabilityDueDate],
    ['preliminary_target_date', preliminaryTargetDate],
    ['final_publish_target_date', finalPublishTargetDate],
  ] as const) {
    if (value && !parseDateKey(value)) errors.push(`invalid_${field}`)
  }

  if (availabilityDueDate && compareDateKeys(availabilityDueDate, input.startDate) >= 0) {
    errors.push('availability_due_after_start')
  }
  if (
    finalPublishTargetDate &&
    parseDateKey(finalPublishTargetDate) &&
    compareDateKeys(finalPublishTargetDate, input.startDate) >= 0
  ) {
    errors.push('final_publish_target_after_start')
  }
  if (
    availabilityDueDate &&
    preliminaryTargetDate &&
    compareDateKeys(availabilityDueDate, preliminaryTargetDate) > 0
  ) {
    errors.push('availability_due_after_preliminary_target')
  }
  if (
    preliminaryTargetDate &&
    finalPublishTargetDate &&
    compareDateKeys(preliminaryTargetDate, finalPublishTargetDate) > 0
  ) {
    errors.push('preliminary_target_after_final_publish_target')
  }
  if (
    availabilityDueDate &&
    preliminaryTargetDate &&
    finalPublishTargetDate &&
    (availabilityDueDate === preliminaryTargetDate ||
      preliminaryTargetDate === finalPublishTargetDate)
  ) {
    warnings.push('compressed_timeline')
  }

  const overlappingCycle = existingCycles.find(
    (cycle) =>
      cycle.id !== currentCycleId &&
      !cycle.archived_at &&
      cycle.status !== 'archived' &&
      hasDateOverlap(cycle, input.startDate, input.endDate)
  )
  if (overlappingCycle) errors.push('schedule_block_overlap')

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export function isTherapistVisibleForAvailability(
  cycle: Pick<
    ScheduleBlockPlanningCycle,
    'availability_due_at' | 'archived_at' | 'published' | 'status' | 'start_date' | 'end_date'
  >,
  todayKey: string
): boolean {
  if (!cycle.availability_due_at) return false
  if (cycle.archived_at || cycle.status === 'archived') return false
  if (cycle.published || cycle.status === 'final' || cycle.status === 'offline') return false
  return cycle.end_date >= todayKey
}

export function sortVisibleAvailabilityCycles<T extends ScheduleBlockPlanningCycle>(
  cycles: T[]
): T[] {
  return [...cycles].sort((a, b) => {
    const leftDue = availabilityDueDateKey(a.availability_due_at) ?? '9999-12-31'
    const rightDue = availabilityDueDateKey(b.availability_due_at) ?? '9999-12-31'
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue)
    return a.start_date.localeCompare(b.start_date)
  })
}
