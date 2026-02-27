import { describe, expect, it } from 'vitest'

import { isAllowedByPattern, isWeekendOn, normalizeWorkPattern, type WorkPattern } from '@/lib/coverage/work-patterns'

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
})
