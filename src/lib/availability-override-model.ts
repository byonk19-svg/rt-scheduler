import type { AvailabilityOverrideRow, ShiftTypeForAvailability } from '@/lib/coverage/types'
import { shiftTypeMatches } from '@/lib/coverage/work-patterns'
import { countsTowardWeeklyLimit } from '@/lib/schedule-helpers'

type DayNightShiftType = Exclude<ShiftTypeForAvailability, 'both'>

export type OverrideScheduleShift = {
  user_id?: string | null
  date: string
  shift_type: DayNightShiftType
  status?: string
}

export type OverrideOutcome =
  | { kind: 'honored'; reason: 'force_on_scheduled' | 'force_off_unscheduled' }
  | { kind: 'violated'; reason: 'force_on_not_scheduled' | 'force_off_scheduled' }
  | { kind: 'skipped'; reason: 'unsupported_override_type' | 'unsupported_force_on_source' }

export function findMatchingOverride(params: {
  overrides: AvailabilityOverrideRow[]
  therapistId: string
  cycleId: string
  date: string
  shiftType: DayNightShiftType
}): AvailabilityOverrideRow | null {
  const sameScope = params.overrides.filter(
    (override) =>
      override.therapist_id === params.therapistId &&
      override.cycle_id === params.cycleId &&
      override.date === params.date &&
      shiftTypeMatches(override.shift_type, params.shiftType)
  )

  if (sameScope.length === 0) return null

  return (
    sameScope.slice().sort((a, b) => {
      const aExact = a.shift_type === params.shiftType ? 1 : 0
      const bExact = b.shift_type === params.shiftType ? 1 : 0
      if (aExact !== bExact) return bExact - aExact

      const aManager = a.source === 'manager' ? 1 : 0
      const bManager = b.source === 'manager' ? 1 : 0
      if (aManager !== bManager) return bManager - aManager

      return 0
    })[0] ?? null
  )
}

export function classifyOverrideOutcome(params: {
  override: AvailabilityOverrideRow
  scheduledShifts: OverrideScheduleShift[]
}): OverrideOutcome {
  const { override, scheduledShifts } = params

  if (override.override_type === 'force_off') {
    const scheduled = scheduledShifts.some((shift) => overrideMatchesShift(override, shift))
    return scheduled
      ? { kind: 'violated', reason: 'force_off_scheduled' }
      : { kind: 'honored', reason: 'force_off_unscheduled' }
  }

  if (override.override_type === 'force_on') {
    if (override.source !== 'manager' && override.source !== 'therapist') {
      return { kind: 'skipped', reason: 'unsupported_force_on_source' }
    }

    const scheduled = scheduledShifts.some((shift) => {
      if (shift.user_id != null && shift.user_id !== override.therapist_id) return false
      if (!overrideMatchesShift(override, shift)) return false
      return shift.status == null || countsTowardWeeklyLimit(shift.status)
    })

    return scheduled
      ? { kind: 'honored', reason: 'force_on_scheduled' }
      : { kind: 'violated', reason: 'force_on_not_scheduled' }
  }

  return { kind: 'skipped', reason: 'unsupported_override_type' }
}

export function countViolatedForceOnOverrides(params: {
  overrides: AvailabilityOverrideRow[]
  scheduledShifts: OverrideScheduleShift[]
}): number {
  return params.overrides.filter((override) => {
    const outcome = classifyOverrideOutcome({
      override,
      scheduledShifts: params.scheduledShifts,
    })
    return outcome.kind === 'violated' && outcome.reason === 'force_on_not_scheduled'
  }).length
}

function overrideMatchesShift(
  override: Pick<AvailabilityOverrideRow, 'date' | 'shift_type'>,
  shift: OverrideScheduleShift
) {
  if (shift.date !== override.date) return false
  return shiftTypeMatches(override.shift_type, shift.shift_type)
}
