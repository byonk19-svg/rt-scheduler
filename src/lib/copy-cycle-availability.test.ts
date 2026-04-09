import { describe, expect, it } from 'vitest'

import { shiftOverridesToCycle, type SourceOverride } from '@/lib/copy-cycle-availability'

const BASE: SourceOverride = {
  date: '2026-02-11',
  override_type: 'force_on',
  shift_type: 'both',
  note: null,
}

const PARAMS = {
  sourceCycleStart: '2026-02-08',
  targetCycleStart: '2026-03-22',
  targetCycleEnd: '2026-05-02',
  existingTargetDates: new Set<string>(),
}

describe('shiftOverridesToCycle', () => {
  it('shifts dates forward by the gap between cycle starts', () => {
    const result = shiftOverridesToCycle({
      ...PARAMS,
      sourceOverrides: [{ ...BASE, date: '2026-02-11' }],
    })

    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-03-25')
  })

  it('preserves override_type, shift_type, and note', () => {
    const result = shiftOverridesToCycle({
      ...PARAMS,
      sourceOverrides: [
        {
          date: '2026-02-12',
          override_type: 'force_off',
          shift_type: 'day',
          note: 'Family event',
        },
      ],
    })

    expect(result[0]).toMatchObject({
      date: '2026-03-26',
      override_type: 'force_off',
      shift_type: 'day',
      note: 'Family event',
    })
  })

  it('excludes dates that fall outside the target cycle range', () => {
    const onEnd = shiftOverridesToCycle({
      ...PARAMS,
      sourceOverrides: [{ ...BASE, date: '2026-03-21' }],
    })

    expect(onEnd[0].date).toBe('2026-05-02')

    const pastEnd = shiftOverridesToCycle({
      ...PARAMS,
      sourceOverrides: [{ ...BASE, date: '2026-03-22' }],
    })

    expect(pastEnd).toHaveLength(0)
  })

  it('skips dates that already exist in the target cycle', () => {
    const result = shiftOverridesToCycle({
      ...PARAMS,
      sourceOverrides: [{ ...BASE, date: '2026-02-11' }],
      existingTargetDates: new Set(['2026-03-25']),
    })

    expect(result).toHaveLength(0)
  })

  it('returns empty when source list is empty', () => {
    expect(shiftOverridesToCycle({ ...PARAMS, sourceOverrides: [] })).toEqual([])
  })

  it('handles a zero-day gap (same cycle start) by passing dates through', () => {
    const result = shiftOverridesToCycle({
      ...PARAMS,
      sourceCycleStart: '2026-03-22',
      targetCycleStart: '2026-03-22',
      sourceOverrides: [{ ...BASE, date: '2026-03-25' }],
    })

    expect(result[0].date).toBe('2026-03-25')
  })
})
