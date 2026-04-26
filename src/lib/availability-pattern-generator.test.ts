import { describe, expect, it } from 'vitest'

import { buildCycleAvailabilityBaseline } from '@/lib/availability-pattern-generator'
import { normalizeWorkPattern } from '@/lib/coverage/work-patterns'

describe('buildCycleAvailabilityBaseline', () => {
  it('generates weekly baseline availability plus every-other-weekend offs', () => {
    const pattern = normalizeWorkPattern({
      therapist_id: 'therapist-1',
      pattern_type: 'weekly_with_weekend_rotation',
      weekly_weekdays: [1, 2, 4, 5],
      works_dow_mode: 'hard',
      weekend_rule: 'every_other_weekend',
      weekend_anchor_date: '2026-05-02',
    })

    const baseline = buildCycleAvailabilityBaseline({
      cycleStart: '2026-05-01',
      cycleEnd: '2026-05-10',
      pattern,
    })

    expect(baseline['2026-05-02']?.baselineStatus).toBe('available')
    expect(baseline['2026-05-03']?.baselineStatus).toBe('available')
    expect(baseline['2026-05-09']?.baselineStatus).toBe('off')
    expect(baseline['2026-05-10']?.baselineStatus).toBe('off')
    expect(baseline['2026-05-06']?.baselineStatus).toBe('off')
  })

  it('generates repeating-cycle work/off segments from the anchor date', () => {
    const pattern = normalizeWorkPattern({
      therapist_id: 'therapist-1',
      pattern_type: 'repeating_cycle',
      cycle_anchor_date: '2026-05-01',
      cycle_segments: [
        { kind: 'work', length_days: 2 },
        { kind: 'off', length_days: 1 },
      ],
    })

    const baseline = buildCycleAvailabilityBaseline({
      cycleStart: '2026-05-01',
      cycleEnd: '2026-05-06',
      pattern,
    })

    expect(baseline['2026-05-01']?.baselineStatus).toBe('available')
    expect(baseline['2026-05-02']?.baselineStatus).toBe('available')
    expect(baseline['2026-05-03']?.baselineStatus).toBe('off')
    expect(baseline['2026-05-04']?.baselineStatus).toBe('available')
    expect(baseline['2026-05-05']?.baselineStatus).toBe('available')
    expect(baseline['2026-05-06']?.baselineStatus).toBe('off')
  })

  it('returns blank baseline when no recurring pattern is saved', () => {
    const pattern = normalizeWorkPattern({
      therapist_id: 'therapist-1',
      pattern_type: 'none',
    })

    const baseline = buildCycleAvailabilityBaseline({
      cycleStart: '2026-05-01',
      cycleEnd: '2026-05-03',
      pattern,
    })

    expect(baseline['2026-05-01']?.baselineSource).toBe('none')
    expect(baseline['2026-05-01']?.baselineStatus).toBe('off')
    expect(baseline['2026-05-03']?.baselineStatus).toBe('off')
  })
})
