import {
  normalizeFmlaReturnDate,
  type EmployeeEmploymentType,
  type EmployeeShiftType,
} from '@/lib/employee-directory'

export type TeamQuickEditRole = 'manager' | 'lead' | 'therapist'
export type TeamQuickEditError =
  | 'missing_profile'
  | 'missing_name'
  | 'invalid_role'
  | 'invalid_shift'
  | 'invalid_employment'

export type WorkPatternInput = {
  hasPattern: boolean
  worksDow: number[]
  worksDowMode: 'hard' | 'soft'
  offsDow: number[]
  weekendRotation: 'none' | 'every_other'
  weekendAnchorDate: string | null
}

export type TeamQuickEditInput = {
  profileId: string
  fullName: string
  role: TeamQuickEditRole
  shiftType: EmployeeShiftType
  employmentType: EmployeeEmploymentType
  isLeadEligible: boolean
  onFmla: boolean
  fmlaReturnDate: string | null
  isActive: boolean
  workPattern: WorkPatternInput
}

type TeamQuickEditResult =
  | { ok: true; value: TeamQuickEditInput }
  | { ok: false; error: TeamQuickEditError; profileId?: string }

function normalizeRole(raw: string): TeamQuickEditRole | null {
  if (raw === 'manager' || raw === 'lead' || raw === 'therapist') return raw
  return null
}

function normalizeShift(raw: string): EmployeeShiftType | null {
  if (raw === 'day' || raw === 'night') return raw
  return null
}

function normalizeEmployment(raw: string): EmployeeEmploymentType | null {
  if (raw === 'full_time' || raw === 'part_time' || raw === 'prn') return raw
  return null
}

export function parseTeamQuickEditFormData(formData: FormData): TeamQuickEditResult {
  const profileId = String(formData.get('profile_id') ?? '').trim()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const role = normalizeRole(String(formData.get('role') ?? '').trim())
  const shiftType = normalizeShift(String(formData.get('shift_type') ?? '').trim())
  const employmentType = normalizeEmployment(String(formData.get('employment_type') ?? '').trim())

  if (!profileId) {
    return { ok: false, error: 'missing_profile' }
  }

  if (!fullName) {
    return { ok: false, error: 'missing_name', profileId }
  }

  if (!role) {
    return { ok: false, error: 'invalid_role', profileId }
  }

  if (!shiftType) {
    return { ok: false, error: 'invalid_shift', profileId }
  }

  if (!employmentType) {
    return { ok: false, error: 'invalid_employment', profileId }
  }

  const onFmla = formData.get('on_fmla') === 'on'

  const hasPattern = formData.get('has_recurring_schedule') === 'on'
  const worksDow = formData
    .getAll('works_dow')
    .map((v) => parseInt(String(v), 10))
    .filter((n) => !isNaN(n) && n >= 0 && n <= 6)
  const offsDow = formData
    .getAll('offs_dow')
    .map((v) => parseInt(String(v), 10))
    .filter((n) => !isNaN(n) && n >= 0 && n <= 6)
  const worksDowModeRaw = String(formData.get('works_dow_mode') ?? 'hard')
  const worksDowMode: 'hard' | 'soft' = worksDowModeRaw === 'soft' ? 'soft' : 'hard'
  const weekendRotationRaw = String(formData.get('weekend_rotation') ?? 'none')
  const weekendRotation: 'none' | 'every_other' =
    weekendRotationRaw === 'every_other' ? 'every_other' : 'none'
  const weekendAnchorDateRaw = String(formData.get('weekend_anchor_date') ?? '').trim()
  const weekendAnchorDate =
    weekendRotation === 'every_other' && weekendAnchorDateRaw ? weekendAnchorDateRaw : null

  return {
    ok: true,
    value: {
      profileId,
      fullName,
      role,
      shiftType,
      employmentType,
      isLeadEligible: role === 'lead',
      onFmla,
      fmlaReturnDate: normalizeFmlaReturnDate(
        String(formData.get('fmla_return_date') ?? ''),
        onFmla
      ),
      isActive: formData.get('is_active') === 'on',
      workPattern: {
        hasPattern,
        worksDow,
        worksDowMode,
        offsDow,
        weekendRotation,
        weekendAnchorDate,
      },
    },
  }
}
