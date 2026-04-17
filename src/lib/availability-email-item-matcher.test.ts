import { describe, expect, it } from 'vitest'

import {
  extractAvailabilityEmployeeName,
  matchAvailabilityEmailEmployee,
} from '@/lib/availability-email-item-matcher'

describe('extractAvailabilityEmployeeName', () => {
  it('extracts an explicit employee name label', () => {
    expect(
      extractAvailabilityEmployeeName(
        'PTO REQUEST/EDIT FORM\nEmployee Name: Brianna Brown\nNeed off Apr 14'
      )
    ).toBe('Brianna Brown')
  })

  it('extracts the employee name when other labels appear on the same line', () => {
    expect(
      extractAvailabilityEmployeeName(
        'Employee Name: Brianna Yonkin   Kronos Number: _____________'
      )
    ).toBe('Brianna Yonkin')
  })

  it('falls back to a plain name line when no label is present', () => {
    expect(extractAvailabilityEmployeeName('Brianna Brown\nNeed off Apr 14 and Apr 16')).toBe(
      'Brianna Brown'
    )
  })
})

describe('matchAvailabilityEmailEmployee', () => {
  const profiles = [
    { id: 'p1', full_name: 'Brianna Brown', is_active: true },
    { id: 'p2', full_name: 'Bryan Brown', is_active: true },
    { id: 'p3', full_name: 'Inactive Person', is_active: false },
  ]

  it('returns one exact active match for the extracted employee name', () => {
    expect(
      matchAvailabilityEmailEmployee('Employee Name: Brianna Brown\nNeed off Apr 14', profiles)
    ).toEqual({
      extractedName: 'Brianna Brown',
      matchedTherapistId: 'p1',
      confidence: 'high',
      reasons: [],
      candidates: [{ id: 'p1', fullName: 'Brianna Brown' }],
    })
  })

  it('returns a medium-confidence ambiguous result for fuzzy matches', () => {
    expect(matchAvailabilityEmailEmployee('Name: Brown\nNeed off Apr 14', profiles)).toEqual({
      extractedName: 'Brown',
      matchedTherapistId: null,
      confidence: 'medium',
      reasons: ['employee_match_ambiguous'],
      candidates: [
        { id: 'p1', fullName: 'Brianna Brown' },
        { id: 'p2', fullName: 'Bryan Brown' },
      ],
    })
  })

  it('returns a missing-match reason when no active profile matches', () => {
    expect(
      matchAvailabilityEmailEmployee('Employee Name: Jordan Smith\nNeed off Apr 14', profiles)
    ).toEqual({
      extractedName: 'Jordan Smith',
      matchedTherapistId: null,
      confidence: 'low',
      reasons: ['employee_match_missing'],
      candidates: [],
    })
  })
})
