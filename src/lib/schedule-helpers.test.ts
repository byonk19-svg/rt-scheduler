import { describe, expect, it } from 'vitest'

import type { Therapist } from '@/app/schedule/types'
import { getScheduleFeedback, pickTherapistForDate } from '@/lib/schedule-helpers'

describe('schedule feedback messaging', () => {
  it('summarizes publish blocking with lead and coverage issue counts', () => {
    const feedback = getScheduleFeedback({
      error: 'publish_shift_rule_violation',
      under_coverage: '2',
      over_coverage: '1',
      lead_missing: '3',
      lead_multiple: '1',
      lead_ineligible: '1',
      affected: '2026-03-22 day, 2026-03-22 night',
    })

    expect(feedback?.variant).toBe('error')
    expect(feedback?.message).toContain('Coverage under: 2')
    expect(feedback?.message).toContain('coverage over: 1')
    expect(feedback?.message).toContain('missing lead: 3')
    expect(feedback?.message).toContain('Affected: 2026-03-22 day, 2026-03-22 night')
  })
})

describe('auto-generate preferred day selection', () => {
  it('prioritizes therapists who prefer the target weekday', () => {
    const therapists: Therapist[] = [
      {
        id: 'a',
        full_name: 'Alex',
        shift_type: 'day',
        is_lead_eligible: false,
        employment_type: 'full_time',
        max_work_days_per_week: 3,
        preferred_work_days: [2],
        on_fmla: false,
        fmla_return_date: null,
        is_active: true,
      },
      {
        id: 'b',
        full_name: 'Bailey',
        shift_type: 'day',
        is_lead_eligible: false,
        employment_type: 'full_time',
        max_work_days_per_week: 3,
        preferred_work_days: [1],
        on_fmla: false,
        fmla_return_date: null,
        is_active: true,
      },
    ]

    const pick = pickTherapistForDate(
      therapists,
      0,
      '2026-02-23',
      new Map(),
      new Set(),
      new Map(),
      new Map([
        ['a', 3],
        ['b', 3],
      ])
    )

    expect(pick.therapist?.id).toBe('b')
  })

  it('falls back to non-preferred therapists when needed', () => {
    const therapists: Therapist[] = [
      {
        id: 'a',
        full_name: 'Alex',
        shift_type: 'day',
        is_lead_eligible: false,
        employment_type: 'full_time',
        max_work_days_per_week: 3,
        preferred_work_days: [2],
        on_fmla: false,
        fmla_return_date: null,
        is_active: true,
      },
    ]

    const pick = pickTherapistForDate(
      therapists,
      0,
      '2026-02-23',
      new Map(),
      new Set(),
      new Map(),
      new Map([['a', 3]])
    )

    expect(pick.therapist?.id).toBe('a')
  })
})
