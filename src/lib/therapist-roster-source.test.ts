import { describe, expect, it } from 'vitest'

import { parseTherapistRosterSource } from '@/lib/therapist-roster-source'

describe('parseTherapistRosterSource', () => {
  it('parses therapist source lines into defaulted bulk roster rows', () => {
    const result = parseTherapistRosterSource(
      ['Brooks, Tannie 903-217-7833', 'Smith, Jane (214)555-1212'].join('\n')
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.rows).toEqual([
      {
        full_name: 'Tannie Brooks',
        normalized_full_name: 'tannie brooks',
        phone_number: '(903) 217-7833',
        role: 'therapist',
        shift_type: 'day',
        employment_type: 'full_time',
        max_work_days_per_week: 3,
        is_lead_eligible: false,
        is_active: true,
      },
      {
        full_name: 'Jane Smith',
        normalized_full_name: 'jane smith',
        phone_number: '(214) 555-1212',
        role: 'therapist',
        shift_type: 'day',
        employment_type: 'full_time',
        max_work_days_per_week: 3,
        is_lead_eligible: false,
        is_active: true,
      },
    ])
  })

  it('rejects duplicate normalized names in the source payload', () => {
    const result = parseTherapistRosterSource(
      ['Brooks, Tannie 903-217-7833', 'brooks,   tannie 2145551212'].join('\n')
    )

    expect(result).toEqual({
      ok: false,
      line: 2,
      message: 'Duplicate therapist name "Tannie Brooks".',
    })
  })

  it('leaves non-10-digit phones unformatted', () => {
    const result = parseTherapistRosterSource('Brooks, Tannie 903-217-783')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.rows[0]?.phone_number).toBe('903-217-783')
  })
})
