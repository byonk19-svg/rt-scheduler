export type AvailabilityEntryType = 'unavailable' | 'available'
export type EmploymentType = 'full_time' | 'part_time' | 'prn'

export function normalizeEmploymentType(value: string | null | undefined): EmploymentType {
  if (value === 'prn' || value === 'part_time') return value
  return 'full_time'
}

export function getAvailabilityEntryTypeForEmploymentType(
  employmentType: EmploymentType
): AvailabilityEntryType {
  return employmentType === 'prn' ? 'available' : 'unavailable'
}
