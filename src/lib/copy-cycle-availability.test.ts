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
  sourceCycleEnd: '2026-03-14',
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
      sourceCycleEnd: '2026-03-21',
      sourceOverrides: [{ ...BASE, date: '2026-03-21' }],
    })

    expect(onEnd[0].date).toBe('2026-05-02')

    const pastEnd = shiftOverridesToCycle({
      ...PARAMS,
      sourceCycleEnd: '2026-03-21',
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

  it('maps by weekday occurrence instead of absolute day index when cycle starts differ', () => {
    const result = shiftOverridesToCycle({
      ...PARAMS,
      sourceCycleStart: '2026-02-09',
      sourceCycleEnd: '2026-03-15',
      targetCycleStart: '2026-03-22',
      sourceOverrides: [{ ...BASE, date: '2026-02-10' }],
    })

    expect(result[0].date).toBe('2026-03-24')
  })

  it('expands full weekday patterns into extra weeks in a longer target cycle', () => {
    const result = shiftOverridesToCycle({
      ...PARAMS,
      sourceOverrides: [
        { ...BASE, date: '2026-02-09', override_type: 'force_off' },
        { ...BASE, date: '2026-02-16', override_type: 'force_off' },
        { ...BASE, date: '2026-02-23', override_type: 'force_off' },
        { ...BASE, date: '2026-03-02', override_type: 'force_off' },
        { ...BASE, date: '2026-03-09', override_type: 'force_off' },
      ],
    })

    expect(result.map((row) => row.date)).toEqual([
      '2026-03-23',
      '2026-03-30',
      '2026-04-06',
      '2026-04-13',
      '2026-04-20',
      '2026-04-27',
    ])
  })

  it('returns empty when source list is empty', () => {
    expect(shiftOverridesToCycle({ ...PARAMS, sourceOverrides: [] })).toEqual([])
  })

  it('handles a zero-day gap (same cycle start) by passing dates through', () => {
    const result = shiftOverridesToCycle({
      ...PARAMS,
      sourceCycleStart: '2026-03-22',
      sourceCycleEnd: '2026-05-02',
      targetCycleStart: '2026-03-22',
      sourceOverrides: [{ ...BASE, date: '2026-03-25' }],
    })

    expect(result[0].date).toBe('2026-03-25')
  })
})
