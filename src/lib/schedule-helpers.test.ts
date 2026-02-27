import { describe, expect, it } from 'vitest'

import type { AvailabilityOverrideRow, Therapist } from '@/app/schedule/types'
import { getScheduleFeedback, pickTherapistForDate } from '@/lib/schedule-helpers'

function buildTherapist(overrides?: Partial<Therapist>): Therapist {
  return {
    id: 'therapist-1',
    full_name: 'Therapist One',
    shift_type: 'day',
    is_lead_eligible: false,
    employment_type: 'full_time',
    max_work_days_per_week: 3,
    works_dow: [],
    offs_dow: [],
    weekend_rotation: 'none',
    weekend_anchor_date: null,
    works_dow_mode: 'hard',
    shift_preference: 'either',
    on_fmla: false,
    fmla_return_date: null,
    is_active: true,
    ...overrides,
  }
}

function buildOverride(overrides?: Partial<AvailabilityOverrideRow>): AvailabilityOverrideRow {
  return {
    cycle_id: 'cycle-1',
    therapist_id: 'therapist-1',
    date: '2026-03-06',
    shift_type: 'both',
    override_type: 'force_off',
    note: null,
    ...overrides,
  }
}

describe('schedule feedback messaging', () => {
  it('summarizes publish blocking with lead and coverage issue counts', () => {
    const feedback = getScheduleFeedback({
      error: 'publish_shift_rule_violation',
      under_coverage: '2',
      over_coverage: '1',
      lead_missing: '3',
      lead_multiple: '1',
      lead_ineligible: '1',
    })

    expect(feedback?.variant).toBe('error')
    expect(feedback?.message).toContain('Coverage under: 2')
    expect(feedback?.message).toContain('coverage over: 1')
    expect(feedback?.message).toContain('missing lead: 3')
    expect(feedback?.message).toContain('multiple leads: 1')
    expect(feedback?.message).toContain('ineligible lead: 1')
  })

  it('includes constraint-driven unfilled counts after auto-generate', () => {
    const feedback = getScheduleFeedback({
      auto: 'generated',
      added: '8',
      unfilled: '0',
      lead_missing: '0',
      constraints_unfilled: '2',
    })

    expect(feedback?.variant).toBe('error')
    expect(feedback?.message).toContain('2 slots were left unfilled due to constraints.')
  })
})

describe('pickTherapistForDate', () => {
  it('chooses lower weekly count first', () => {
    const therapists: Therapist[] = [
      buildTherapist({ id: 'a', full_name: 'Alex' }),
      buildTherapist({ id: 'b', full_name: 'Bailey' }),
    ]

    const pick = pickTherapistForDate(
      therapists,
      0,
      '2026-03-02',
      'day',
      new Map<string, AvailabilityOverrideRow[]>(),
      'cycle-1',
      new Set<string>(),
      new Map<string, Set<string>>([
        ['a:2026-03-01', new Set(['2026-03-01', '2026-03-02'])],
        ['b:2026-03-01', new Set(['2026-03-01'])],
      ]),
      new Map([
        ['a', 3],
        ['b', 3],
      ])
    )

    expect(pick.therapist?.id).toBe('b')
  })

  it('blocks offs_dow weekday assignments', () => {
    const therapist = buildTherapist({
      offs_dow: [1],
      works_dow_mode: 'soft',
    })

    const pick = pickTherapistForDate(
      [therapist],
      0,
      '2026-03-02',
      'day',
      new Map<string, AvailabilityOverrideRow[]>(),
      'cycle-1',
      new Set<string>(),
      new Map(),
      new Map([['therapist-1', 3]])
    )

    expect(pick.therapist).toBeNull()
  })

  it('blocks non-works day when works_dow_mode is hard', () => {
    const therapist = buildTherapist({
      works_dow: [2],
      works_dow_mode: 'hard',
    })

    const pick = pickTherapistForDate(
      [therapist],
      0,
      '2026-03-02',
      'day',
      new Map<string, AvailabilityOverrideRow[]>(),
      'cycle-1',
      new Set<string>(),
      new Map(),
      new Map([['therapist-1', 3]])
    )

    expect(pick.therapist).toBeNull()
  })

  it('blocks PRN when date is not offered by recurring pattern', () => {
    const therapist = buildTherapist({
      employment_type: 'prn',
      works_dow: [2],
      works_dow_mode: 'soft',
    })

    const pick = pickTherapistForDate(
      [therapist],
      0,
      '2026-03-02',
      'day',
      new Map<string, AvailabilityOverrideRow[]>(),
      'cycle-1',
      new Set<string>(),
      new Map(),
      new Map([['therapist-1', 3]])
    )

    expect(pick.therapist).toBeNull()
  })

  it('allows PRN when recurring pattern offers the weekday', () => {
    const therapist = buildTherapist({
      employment_type: 'prn',
      works_dow: [1],
      works_dow_mode: 'hard',
    })

    const pick = pickTherapistForDate(
      [therapist],
      0,
      '2026-03-02',
      'day',
      new Map<string, AvailabilityOverrideRow[]>(),
      'cycle-1',
      new Set<string>(),
      new Map(),
      new Map([['therapist-1', 3]])
    )

    expect(pick.therapist?.id).toBe('therapist-1')
  })

  it('prefers works_dow matches when mode is soft', () => {
    const therapists: Therapist[] = [
      buildTherapist({
        id: 'soft-non-match',
        full_name: 'Soft Non Match',
        works_dow: [2],
        works_dow_mode: 'soft',
      }),
      buildTherapist({
        id: 'soft-match',
        full_name: 'Soft Match',
        works_dow: [1],
        works_dow_mode: 'soft',
      }),
    ]

    const pick = pickTherapistForDate(
      therapists,
      0,
      '2026-03-02',
      'day',
      new Map<string, AvailabilityOverrideRow[]>(),
      'cycle-1',
      new Set<string>(),
      new Map(),
      new Map([
        ['soft-non-match', 3],
        ['soft-match', 3],
      ])
    )

    expect(pick.therapist?.id).toBe('soft-match')
  })

  it('supports every-other weekend parity', () => {
    const therapist = buildTherapist({
      weekend_rotation: 'every_other',
      weekend_anchor_date: '2026-02-21',
      works_dow_mode: 'soft',
    })

    const allowedWeekend = pickTherapistForDate(
      [therapist],
      0,
      '2026-03-07',
      'day',
      new Map<string, AvailabilityOverrideRow[]>(),
      'cycle-1',
      new Set<string>(),
      new Map(),
      new Map([['therapist-1', 3]])
    )

    expect(allowedWeekend.therapist?.id).toBe('therapist-1')

    const blockedWeekend = pickTherapistForDate(
      [therapist],
      0,
      '2026-02-28',
      'day',
      new Map<string, AvailabilityOverrideRow[]>(),
      'cycle-1',
      new Set<string>(),
      new Map(),
      new Map([['therapist-1', 3]])
    )

    expect(blockedWeekend.therapist).toBeNull()
  })

  it('force_on override allows scheduling outside hard recurring pattern', () => {
    const therapist = buildTherapist({
      employment_type: 'prn',
      works_dow: [2],
      works_dow_mode: 'hard',
    })

    const pick = pickTherapistForDate(
      [therapist],
      0,
      '2026-03-06',
      'day',
      new Map<string, AvailabilityOverrideRow[]>([
        ['therapist-1', [buildOverride({ override_type: 'force_on' })]],
      ]),
      'cycle-1',
      new Set<string>(),
      new Map(),
      new Map([['therapist-1', 3]])
    )

    expect(pick.therapist?.id).toBe('therapist-1')
  })

  it('force_off override blocks even on normal works day', () => {
    const therapist = buildTherapist({
      works_dow: [5],
      works_dow_mode: 'hard',
    })

    const pick = pickTherapistForDate(
      [therapist],
      0,
      '2026-03-06',
      'day',
      new Map<string, AvailabilityOverrideRow[]>([
        ['therapist-1', [buildOverride({ override_type: 'force_off' })]],
      ]),
      'cycle-1',
      new Set<string>(),
      new Map(),
      new Map([['therapist-1', 3]])
    )

    expect(pick.therapist).toBeNull()
  })
})
