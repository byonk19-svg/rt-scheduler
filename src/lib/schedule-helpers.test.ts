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
    expect(feedback?.message).toContain('multiple leads: 1')
    expect(feedback?.message).toContain('ineligible lead: 1')
    expect(feedback?.message).not.toContain('Affected:')
  })

  it('shows lead warning when auto-generate cannot assign a lead to every shift', () => {
    const feedback = getScheduleFeedback({
      auto: 'generated',
      added: '12',
      unfilled: '0',
      lead_missing: '2',
    })

    expect(feedback?.variant).toBe('error')
    expect(feedback?.message).toContain('Draft generated with 12 new shifts.')
    expect(feedback?.message).toContain('2 shifts still need a designated lead.')
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

  it('does not auto-schedule PRN therapists without preferred work days', () => {
    const therapists: Therapist[] = [
      {
        id: 'prn-no-days',
        full_name: 'PRN No Days',
        shift_type: 'day',
        is_lead_eligible: false,
        employment_type: 'prn',
        max_work_days_per_week: 1,
        preferred_work_days: [],
        on_fmla: false,
        fmla_return_date: null,
        is_active: true,
      },
      {
        id: 'full-time',
        full_name: 'Full Timer',
        shift_type: 'day',
        is_lead_eligible: false,
        employment_type: 'full_time',
        max_work_days_per_week: 3,
        preferred_work_days: [],
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
        ['prn-no-days', 1],
        ['full-time', 3],
      ])
    )

    expect(pick.therapist?.id).toBe('full-time')
  })

  it('only schedules PRN therapists on their entered preferred days', () => {
    const therapists: Therapist[] = [
      {
        id: 'prn-monday',
        full_name: 'PRN Monday',
        shift_type: 'day',
        is_lead_eligible: false,
        employment_type: 'prn',
        max_work_days_per_week: 1,
        preferred_work_days: [1],
        on_fmla: false,
        fmla_return_date: null,
        is_active: true,
      },
    ]

    const pick = pickTherapistForDate(
      therapists,
      0,
      '2026-02-24',
      new Map(),
      new Set(),
      new Map(),
      new Map([['prn-monday', 1]])
    )

    expect(pick.therapist).toBeNull()
  })
})
