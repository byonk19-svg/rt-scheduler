export type EmployeeShiftType = 'day' | 'night'
export type EmployeeEmploymentType = 'full_time' | 'part_time' | 'prn'
export type EmployeeDirectoryTab = 'all' | 'day' | 'night'

export type EmployeeDirectoryRecord = {
  id: string
  full_name: string
  email: string
  phone_number: string | null
  shift_type: EmployeeShiftType
  employment_type: EmployeeEmploymentType
  max_work_days_per_week: number
  is_lead_eligible: boolean
  on_fmla: boolean
  fmla_return_date: string | null
  is_active: boolean
}

export type EmployeeDirectoryFilters = {
  tab: EmployeeDirectoryTab
  searchText: string
  leadOnly: boolean
  fmlaOnly: boolean
  includeInactive: boolean
}

export function filterEmployeeDirectoryRecords(
  records: EmployeeDirectoryRecord[],
  filters: EmployeeDirectoryFilters
): EmployeeDirectoryRecord[] {
  const search = filters.searchText.trim().toLowerCase()

  return records.filter((record) => {
    if (filters.tab !== 'all' && record.shift_type !== filters.tab) return false
    if (filters.leadOnly && !record.is_lead_eligible) return false
    if (filters.fmlaOnly && !record.on_fmla) return false
    if (!filters.includeInactive && !record.is_active) return false
    if (!search) return true

    const haystack = `${record.full_name} ${record.email}`.toLowerCase()
    return haystack.includes(search)
  })
}

export function getSchedulingEligibleEmployees<T extends { is_active: boolean; on_fmla: boolean }>(rows: T[]): T[] {
  return rows.filter((row) => row.is_active && !row.on_fmla)
}

export function isFmlaReturnDateEnabled(onFmla: boolean): boolean {
  return onFmla
}

export function normalizeFmlaReturnDate(raw: string, onFmla: boolean): string | null {
  if (!onFmla) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed
}

export function formatEmployeeDate(value: string | null): string {
  if (!value) return ''
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function normalizeEmploymentType(raw: string): EmployeeEmploymentType {
  if (raw === 'part_time') return 'part_time'
  if (raw === 'prn') return 'prn'
  return 'full_time'
}

export function normalizeShiftType(raw: string): EmployeeShiftType {
  return raw === 'night' ? 'night' : 'day'
}

export function normalizeActiveValue(raw: string): boolean {
  return raw === 'true'
}

