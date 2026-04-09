import type { ShiftTab } from '@/lib/coverage/selectors'

/** Query key for explicit Day/Night schedule tab on `/coverage`. */
export const COVERAGE_SHIFT_QUERY_KEY = 'shift' as const

/**
 * Parses `?shift=day|night` (case-insensitive). Unknown values return null so
 * callers can fall back to profile defaults.
 */
export function parseCoverageShiftSearchParam(
  raw: string | null | undefined
): ShiftTab | null {
  if (raw == null || raw === '') return null
  const v = raw.trim().toLowerCase()
  if (v === 'night') return 'Night'
  if (v === 'day') return 'Day'
  return null
}

export function shiftTabToQueryValue(tab: ShiftTab): 'day' | 'night' {
  return tab === 'Night' ? 'night' : 'day'
}

/** Maps profile `shift_type` to the schedule tab; anything other than `night` → Day. */
export function defaultCoverageShiftTabFromProfileShift(
  shiftType: unknown
): ShiftTab {
  return shiftType === 'night' ? 'Night' : 'Day'
}

export function normalizeActorShiftType(shiftType: unknown): 'day' | 'night' | null {
  if (shiftType === 'night') return 'night'
  if (shiftType === 'day') return 'day'
  return null
}
