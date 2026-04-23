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

function buildFormDataWithArrays(input: {
  overrides?: Record<string, string | boolean | undefined>
  worksDow?: number[]
  offsDow?: number[]
}) {
  const formData = buildFormData(input.overrides)
  for (const day of input.worksDow ?? []) {
    formData.append('works_dow', String(day))
  }
  for (const day of input.offsDow ?? []) {
    formData.append('offs_dow', String(day))
  }
  return formData
}

describe('parseTeamQuickEditFormData', () => {
  it('parses the quick edit fields for a therapist', () => {
    const result = parseTeamQuickEditFormData(
      buildFormData({
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
        isLeadEligible: false,
        onFmla: true,
        fmlaReturnDate: '2026-05-12',
        isActive: true,
        workPattern: {
          hasPattern: false,
          worksDow: [],
          offsDow: [],
          worksDowMode: 'hard',
          weekendRotation: 'none',
          weekendAnchorDate: null,
        },
      },
    })
  })

  it('derives lead eligibility from the lead role', () => {
    const result = parseTeamQuickEditFormData(
      buildFormData({
        role: 'lead',
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

  it('does not allow therapists to force lead eligibility from form data', () => {
    const result = parseTeamQuickEditFormData(
      buildFormData({
        role: 'therapist',
        is_lead_eligible: true,
      })
    )

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        role: 'therapist',
        isLeadEligible: false,
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

  it('persists never-work weekdays even when fixed weekly pattern is off', () => {
    const result = parseTeamQuickEditFormData(
      buildFormDataWithArrays({
        overrides: {
          has_recurring_schedule: false,
        },
        offsDow: [4],
      })
    )

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        workPattern: {
          hasPattern: true,
          worksDow: [],
          offsDow: [4],
          worksDowMode: 'hard',
          weekendRotation: 'none',
          weekendAnchorDate: null,
        },
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
