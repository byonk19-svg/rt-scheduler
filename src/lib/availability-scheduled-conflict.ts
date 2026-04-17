export type ConflictItem = { date: string; shiftType: 'day' | 'night' | 'both' }

export function findScheduledConflicts(
  overrides: Array<{ date: string; shift_type: string; override_type: string }>,
  scheduledShifts: Array<{ date: string; shift_type: string }>
): ConflictItem[] {
  return overrides.flatMap((override) => {
    if (override.override_type !== 'force_off') return []

    const hasConflict = scheduledShifts.some((shift) => {
      if (shift.date !== override.date) return false
      if (override.shift_type === 'both') return true
      return shift.shift_type === override.shift_type
    })

    if (!hasConflict) return []

    const shiftType: ConflictItem['shiftType'] =
      override.shift_type === 'day' || override.shift_type === 'night'
        ? override.shift_type
        : 'both'

    return [{ date: override.date, shiftType }]
  })
}
