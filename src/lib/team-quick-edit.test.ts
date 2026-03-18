import { describe, expect, it } from 'vitest'

import { parseTeamQuickEditFormData } from '@/lib/team-quick-edit'

function buildFormData(overrides: Record<string, string | boolean | undefined> = {}): FormData {
  const formData = new FormData()
  formData.set('profile_id', 'therapist-1')
  formData.set('full_name', 'Barbara C.')
  formData.set('role', 'therapist')
  formData.set('shift_type', 'day')
  formData.set('employment_type', 'full_time')

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue
    if (typeof value === 'boolean') {
      if (value) formData.set(key, 'on')
      else formData.delete(key)
      continue
    }
    formData.set(key, value)
  }

  return formData
}

describe('parseTeamQuickEditFormData', () => {
  it('parses the quick edit fields for a therapist', () => {
    const result = parseTeamQuickEditFormData(
      buildFormData({
        is_lead_eligible: true,
        on_fmla: true,
        is_active: true,
      })
    )

    expect(result).toEqual({
      ok: true,
      value: {
        profileId: 'therapist-1',
        fullName: 'Barbara C.',
        role: 'therapist',
        shiftType: 'day',
        employmentType: 'full_time',
        isLeadEligible: true,
        onFmla: true,
        isActive: true,
      },
    })
  })

  it('drops lead eligibility when the role is not therapist', () => {
    const result = parseTeamQuickEditFormData(
      buildFormData({
        role: 'manager',
        is_lead_eligible: true,
      })
    )

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        role: 'manager',
        isLeadEligible: false,
      }),
    })
  })

  it('rejects invalid or incomplete input', () => {
    expect(parseTeamQuickEditFormData(buildFormData({ full_name: '   ' }))).toEqual({
      ok: false,
      error: 'missing_name',
      profileId: 'therapist-1',
    })

    expect(parseTeamQuickEditFormData(buildFormData({ role: 'lead' }))).toEqual({
      ok: false,
      error: 'invalid_role',
      profileId: 'therapist-1',
    })

    expect(parseTeamQuickEditFormData(buildFormData({ shift_type: 'swing' }))).toEqual({
      ok: false,
      error: 'invalid_shift',
      profileId: 'therapist-1',
    })
  })
})
