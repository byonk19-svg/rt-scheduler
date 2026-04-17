export type ConflictItem = {
  date: string
  shiftType: 'day' | 'night' | 'both'
}

type AvailabilityOverride = {
  date: string
  shift_type: string
  override_type: string
}

type ScheduledShift = {
  date: string
  shift_type: string
}

export function findScheduledConflicts(
  overrides: AvailabilityOverride[],
  scheduledShifts: ScheduledShift[]
): ConflictItem[] {
  return overrides.flatMap((override) => {
    if (override.override_type !== 'force_off') return []

    const hasMatchingShift = scheduledShifts.some((scheduledShift) => {
      if (scheduledShift.date !== override.date) return false
      if (override.shift_type === 'both') return true
      return scheduledShift.shift_type === override.shift_type
    })

    if (!hasMatchingShift) return []

    const shiftType =
      override.shift_type === 'day' || override.shift_type === 'night'
        ? override.shift_type
        : 'both'

    return [{ date: override.date, shiftType }]
  })
}
