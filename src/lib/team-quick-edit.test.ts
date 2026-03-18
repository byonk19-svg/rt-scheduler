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
        fmla_return_date: '2026-05-12',
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
        fmlaReturnDate: '2026-05-12',
        isActive: true,
      },
    })
  })

  it('parses the lead app role separately from coverage lead eligibility', () => {
    const result = parseTeamQuickEditFormData(
      buildFormData({
        role: 'lead',
        is_lead_eligible: true,
      })
    )

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        role: 'lead',
        isLeadEligible: true,
      }),
    })
  })

  it('clears the FMLA return date when FMLA is unchecked', () => {
    const result = parseTeamQuickEditFormData(
      buildFormData({
        on_fmla: false,
        fmla_return_date: '2026-05-12',
      })
    )

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        onFmla: false,
        fmlaReturnDate: null,
      }),
    })
  })

  it('rejects invalid or incomplete input', () => {
    expect(parseTeamQuickEditFormData(buildFormData({ full_name: '   ' }))).toEqual({
      ok: false,
      error: 'missing_name',
      profileId: 'therapist-1',
    })

    expect(parseTeamQuickEditFormData(buildFormData({ role: 'staff' }))).toEqual({
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
