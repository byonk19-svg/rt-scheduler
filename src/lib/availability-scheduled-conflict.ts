import { classifyOverrideOutcome } from '@/lib/availability-override-model'

export type ConflictItem = { date: string; shiftType: 'day' | 'night' | 'both' }

export function findScheduledConflicts(
  overrides: Array<{
    date: string
    shift_type: 'day' | 'night' | 'both'
    override_type: 'force_off' | 'force_on'
  }>,
  scheduledShifts: Array<{ date: string; shift_type: 'day' | 'night' }>
): ConflictItem[] {
  return overrides.flatMap((override) => {
    const outcome = classifyOverrideOutcome({
      override: {
        cycle_id: '',
        therapist_id: '',
        source: 'therapist',
        ...override,
      },
      scheduledShifts,
    })

    if (outcome.kind !== 'violated' || outcome.reason !== 'force_off_scheduled') return []

    const shiftType: ConflictItem['shiftType'] =
      override.shift_type === 'day' || override.shift_type === 'night'
        ? override.shift_type
        : 'both'

    return [{ date: override.date, shiftType }]
  })
}
