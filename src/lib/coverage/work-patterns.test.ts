import { describe, expect, it } from 'vitest'

import {
  describeWorkPatternSummary,
  isAllowedByPattern,
  isWeekendOn,
  normalizeWorkPattern,
  type WorkPattern,
} from '@/lib/coverage/work-patterns'

function createPattern(overrides?: Partial<WorkPattern>): WorkPattern {
  return normalizeWorkPattern({
    therapist_id: 'therapist-1',
    works_dow: [1, 2, 3],
    offs_dow: [],
    weekend_rotation: 'none',
    weekend_anchor_date: null,
    works_dow_mode: 'hard',
    shift_preference: 'either',
    ...overrides,
  })
}

describe('work-patterns', () => {
  it('excludes dates in offs_dow as hard constraints', () => {
    const pattern = createPattern({
      works_dow: [1, 2, 3, 4],
      offs_dow: [1],
      works_dow_mode: 'soft',
    })

    const decision = isAllowedByPattern(pattern, '2026-03-02')

    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('blocked_offs_dow')
  })

  it('uses every-other weekend parity from saturday anchor', () => {
    const pattern = createPattern({
      weekend_rotation: 'every_other',
      weekend_anchor_date: '2026-02-21',
    })

    expect(isWeekendOn(pattern, '2026-03-07')).toBe(true)
    expect(isWeekendOn(pattern, '2026-03-08')).toBe(true)
    expect(isWeekendOn(pattern, '2026-02-28')).toBe(false)
  })

  it('blocks non-works days when works_dow_mode is hard', () => {
    const pattern = createPattern({
      works_dow: [1, 2, 3],
      works_dow_mode: 'hard',
    })

    const decision = isAllowedByPattern(pattern, '2026-03-06')

    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('blocked_outside_works_dow_hard')
  })

  it('allows non-works days with penalty when works_dow_mode is soft', () => {
    const pattern = createPattern({
      works_dow: [1, 2, 3],
      works_dow_mode: 'soft',
    })

    const decision = isAllowedByPattern(pattern, '2026-03-06')

    expect(decision.allowed).toBe(true)
    expect(decision.reason).toBe('soft_outside_works_dow')
    expect(decision.penalty).toBeGreaterThan(0)
  })

  it('normalizes explicit weekend rules and describes every-other-weekend summaries', () => {
    const pattern = normalizeWorkPattern({
      therapist_id: 'therapist-1',
      pattern_type: 'weekly_with_weekend_rotation',
      weekly_weekdays: [1, 2, 4, 5],
      works_dow_mode: 'hard',
      weekend_rule: 'every_other_weekend',
      weekend_anchor_date: '2026-05-02',
    })

    expect(pattern.pattern_type).toBe('weekly_with_weekend_rotation')
    expect(pattern.weekend_rule).toBe('every_other_weekend')
    expect(pattern.weekly_weekdays).toEqual([1, 2, 4, 5])
    expect(describeWorkPatternSummary(pattern)).toBe(
      'Works Mon, Tue, Thu, Fri. Every other weekend starting May 2, 2026.'
    )
  })

  it('supports repeating cycle patterns with anchors and plain-English summaries', () => {
    const pattern = normalizeWorkPattern({
      therapist_id: 'therapist-1',
      pattern_type: 'repeating_cycle',
      cycle_anchor_date: '2026-05-01',
      cycle_segments: [
        { kind: 'work', length_days: 4 },
        { kind: 'off', length_days: 1 },
        { kind: 'work', length_days: 2 },
        { kind: 'off', length_days: 6 },
      ],
    })

    expect(pattern.pattern_type).toBe('repeating_cycle')
    expect(pattern.cycle_anchor_date).toBe('2026-05-01')
    expect(pattern.cycle_segments).toHaveLength(4)
    expect(describeWorkPatternSummary(pattern)).toBe(
      'Repeats every 13 days starting May 1, 2026.'
    )
  })

  it('rebuilds weekly works_dow from weekly_weekdays when legacy works_dow is empty', () => {
    const pattern = normalizeWorkPattern({
      therapist_id: 'therapist-1',
      pattern_type: 'weekly_fixed',
      works_dow: [],
      weekly_weekdays: [1, 2, 4, 5],
      works_dow_mode: 'hard',
    })

    expect(pattern.works_dow).toEqual([1, 2, 4, 5])
    expect(pattern.weekly_weekdays).toEqual([1, 2, 4, 5])
  })
})
