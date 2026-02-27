export type EmployeeShiftType = 'day' | 'night'
export type EmployeeEmploymentType = 'full_time' | 'part_time' | 'prn'
export type EmployeeDirectoryTab = 'all' | 'day' | 'night'
export type AvailabilityOverrideSource = 'therapist' | 'manager'

export type EmployeeDirectoryRecord = {
  id: string
  full_name: string
  email: string
  phone_number: string | null
  shift_type: EmployeeShiftType
  employment_type: EmployeeEmploymentType
  max_work_days_per_week: number
  works_dow: number[]
  offs_dow: number[]
  weekend_rotation: 'none' | 'every_other'
  weekend_anchor_date: string | null
  works_dow_mode: 'hard' | 'soft'
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

export type EmployeeAvailabilityOverride = {
  id: string
  therapist_id: string
  cycle_id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  override_type: 'force_off' | 'force_on'
  note: string | null
  created_at: string
  source: AvailabilityOverrideSource
}

export type MissingAvailabilityRow = {
  therapistId: string
  therapistName: string
  overridesCount: number
  lastUpdatedAt: string | null
  submitted: boolean
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

export function buildManagerOverrideInput(params: {
  cycleId: string
  therapistId: string
  date: string
  shiftType: 'day' | 'night' | 'both'
  overrideType: 'force_off' | 'force_on'
  note?: string | null
  managerId: string
}) {
  return {
    cycle_id: params.cycleId,
    therapist_id: params.therapistId,
    date: params.date,
    shift_type: params.shiftType,
    override_type: params.overrideType,
    note: params.note?.trim() || null,
    created_by: params.managerId,
    source: 'manager' as const,
  }
}

export function canTherapistMutateOverride(override: EmployeeAvailabilityOverride, therapistId: string): boolean {
  return override.therapist_id === therapistId && override.source === 'therapist'
}

export function buildMissingAvailabilityRows(
  therapists: Array<Pick<EmployeeDirectoryRecord, 'id' | 'full_name' | 'is_active'>>,
  overrides: EmployeeAvailabilityOverride[],
  cycleId: string
): MissingAvailabilityRow[] {
  const byTherapist = new Map<string, EmployeeAvailabilityOverride[]>()

  for (const row of overrides) {
    if (row.cycle_id !== cycleId) continue
    const current = byTherapist.get(row.therapist_id) ?? []
    current.push(row)
    byTherapist.set(row.therapist_id, current)
  }

  return therapists
    .filter((therapist) => therapist.is_active)
    .map((therapist) => {
      const rows = byTherapist.get(therapist.id) ?? []
      const lastUpdatedAt =
        rows.length === 0
          ? null
          : rows
              .map((row) => row.created_at)
              .sort((a, b) => b.localeCompare(a))[0] ?? null
      return {
        therapistId: therapist.id,
        therapistName: therapist.full_name,
        overridesCount: rows.length,
        lastUpdatedAt,
        submitted: rows.length > 0,
      }
    })
    .sort((a, b) => {
      if (a.submitted !== b.submitted) return a.submitted ? 1 : -1
      return a.therapistName.localeCompare(b.therapistName)
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
