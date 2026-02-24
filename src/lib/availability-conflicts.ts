export type AvailabilityShiftType = 'day' | 'night' | 'both'
export type AvailabilityEntryType = 'unavailable' | 'available'

export type AvailabilityEntry = {
  therapistId: string
  date: string
  shiftType: AvailabilityShiftType
  entryType: AvailabilityEntryType
  reason?: string | null
}

export function shiftTypesConflict(entryShiftType: AvailabilityShiftType, shiftType: 'day' | 'night'): boolean {
  return entryShiftType === 'both' || entryShiftType === shiftType
}

export function findUnavailableConflict(
  entries: AvailabilityEntry[],
  date: string,
  shiftType: 'day' | 'night'
): AvailabilityEntry | null {
  for (const entry of entries) {
    if (entry.entryType !== 'unavailable') continue
    if (entry.date !== date) continue
    if (!shiftTypesConflict(entry.shiftType, shiftType)) continue
    return entry
  }
  return null
}

export function hasUnavailableConflict(
  entries: AvailabilityEntry[],
  date: string,
  shiftType: 'day' | 'night'
): boolean {
  return findUnavailableConflict(entries, date, shiftType) !== null
}

export function hasPrnAvailableOffer(
  entries: AvailabilityEntry[],
  date: string,
  shiftType: 'day' | 'night'
): boolean {
  return entries.some(
    (entry) =>
      entry.entryType === 'available' && entry.date === date && shiftTypesConflict(entry.shiftType, shiftType)
  )
}
