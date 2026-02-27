import { describe, expect, it } from 'vitest'

import { resolveAvailability } from '@/lib/coverage/resolve-availability'
import type { AvailabilityOverrideRow } from '@/lib/coverage/types'
import { normalizeWorkPattern, type WorkPattern } from '@/lib/coverage/work-patterns'

function buildPattern(overrides?: Partial<WorkPattern>): WorkPattern {
  return normalizeWorkPattern({
    therapist_id: 'therapist-1',
    works_dow: [1, 2, 3],
    offs_dow: [5],
    weekend_rotation: 'every_other',
    weekend_anchor_date: '2026-02-21',
    works_dow_mode: 'hard',
    shift_preference: 'either',
    ...overrides,
  })
}

function buildOverride(overrides?: Partial<AvailabilityOverrideRow>): AvailabilityOverrideRow {
  return {
    cycle_id: 'cycle-a',
    therapist_id: 'therapist-1',
    date: '2026-03-06',
    shift_type: 'both',
    override_type: 'force_off',
    note: null,
    ...overrides,
  }
}

describe('resolveAvailability', () => {
  it('is cycle-scoped for overrides on same date', () => {
    const pattern = buildPattern({ works_dow: [5], works_dow_mode: 'hard', offs_dow: [] })
    const overrides = [
      buildOverride({
        cycle_id: 'cycle-a',
        date: '2026-03-06',
        override_type: 'force_off',
      }),
    ]

    const inCycleA = resolveAvailability({
      therapistId: 'therapist-1',
      cycleId: 'cycle-a',
      date: '2026-03-06',
      shiftType: 'day',
      isActive: true,
      onFmla: false,
      pattern,
      overrides,
    })

    const inCycleB = resolveAvailability({
      therapistId: 'therapist-1',
      cycleId: 'cycle-b',
      date: '2026-03-06',
      shiftType: 'day',
      isActive: true,
      onFmla: false,
      pattern,
      overrides,
    })

    expect(inCycleA.allowed).toBe(false)
    expect(inCycleA.reason).toBe('override_force_off')
    expect(inCycleB.allowed).toBe(true)
  })

  it('force_off blocks even when recurring pattern would allow', () => {
    const pattern = buildPattern({ works_dow: [5], offs_dow: [], works_dow_mode: 'hard', weekend_rotation: 'none' })

    const resolution = resolveAvailability({
      therapistId: 'therapist-1',
      cycleId: 'cycle-a',
      date: '2026-03-06',
      shiftType: 'day',
      isActive: true,
      onFmla: false,
      pattern,
      overrides: [buildOverride({ override_type: 'force_off' })],
    })

    expect(resolution.allowed).toBe(false)
    expect(resolution.reason).toBe('override_force_off')
  })

  it('force_on allows even when recurring pattern would block', () => {
    const pattern = buildPattern({
      works_dow: [1],
      offs_dow: [5],
      weekend_rotation: 'every_other',
      weekend_anchor_date: '2026-02-21',
      works_dow_mode: 'hard',
    })

    const resolution = resolveAvailability({
      therapistId: 'therapist-1',
      cycleId: 'cycle-a',
      date: '2026-03-06',
      shiftType: 'day',
      isActive: true,
      onFmla: false,
      pattern,
      overrides: [buildOverride({ override_type: 'force_on' })],
    })

    expect(resolution.allowed).toBe(true)
    expect(resolution.reason).toBe('override_force_on')
  })

  it('does not bypass inactive or FMLA with force_on', () => {
    const pattern = buildPattern()
    const overrides = [buildOverride({ override_type: 'force_on' })]

    const inactive = resolveAvailability({
      therapistId: 'therapist-1',
      cycleId: 'cycle-a',
      date: '2026-03-06',
      shiftType: 'day',
      isActive: false,
      onFmla: false,
      pattern,
      overrides,
    })

    const onFmla = resolveAvailability({
      therapistId: 'therapist-1',
      cycleId: 'cycle-a',
      date: '2026-03-06',
      shiftType: 'day',
      isActive: true,
      onFmla: true,
      pattern,
      overrides,
    })

    expect(inactive.allowed).toBe(false)
    expect(inactive.reason).toBe('inactive')
    expect(onFmla.allowed).toBe(false)
    expect(onFmla.reason).toBe('on_fmla')
  })
})
