import type { EmployeeEmploymentType, EmployeeShiftType } from '@/lib/employee-directory'

export type TeamQuickEditRole = 'manager' | 'therapist' | 'staff'
export type TeamQuickEditError =
  | 'missing_profile'
  | 'missing_name'
  | 'invalid_role'
  | 'invalid_shift'
  | 'invalid_employment'

export type TeamQuickEditInput = {
  profileId: string
  fullName: string
  role: TeamQuickEditRole
  shiftType: EmployeeShiftType
  employmentType: EmployeeEmploymentType
  isLeadEligible: boolean
  onFmla: boolean
  isActive: boolean
}

type TeamQuickEditResult =
  | { ok: true; value: TeamQuickEditInput }
  | { ok: false; error: TeamQuickEditError; profileId?: string }

function normalizeRole(raw: string): TeamQuickEditRole | null {
  if (raw === 'manager' || raw === 'therapist' || raw === 'staff') return raw
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

  return {
    ok: true,
    value: {
      profileId,
      fullName,
      role,
      shiftType,
      employmentType,
      isLeadEligible: role === 'therapist' && formData.get('is_lead_eligible') === 'on',
      onFmla: formData.get('on_fmla') === 'on',
      isActive: formData.get('is_active') === 'on',
    },
  }
}
