import { describe, expect, it } from 'vitest'

import { findScheduledConflicts } from '@/lib/availability-scheduled-conflict'

function buildOverride(
  overrides?: Partial<{ date: string; shift_type: string; override_type: string }>
) {
  return {
    date: '2026-04-21',
    shift_type: 'day',
    override_type: 'force_off',
    ...overrides,
  }
}

function buildScheduledShift(overrides?: Partial<{ date: string; shift_type: string }>) {
  return {
    date: '2026-04-21',
    shift_type: 'day',
    ...overrides,
  }
}

describe('findScheduledConflicts', () => {
  it('returns a conflict when a force-off override matches a scheduled shift on the same date', () => {
    expect(findScheduledConflicts([buildOverride()], [buildScheduledShift()])).toEqual([
      { date: '2026-04-21', shiftType: 'day' },
    ])
  })

  it('treats both-shift force-off overrides as conflicting with a scheduled day or night shift', () => {
    expect(
      findScheduledConflicts(
        [buildOverride({ shift_type: 'both' })],
        [buildScheduledShift({ shift_type: 'night' })]
      )
    ).toEqual([{ date: '2026-04-21', shiftType: 'both' }])
  })

  it('ignores request-to-work overrides and mismatched dates or shift types', () => {
    expect(
      findScheduledConflicts(
        [
          buildOverride({ override_type: 'force_on' }),
          buildOverride({ date: '2026-04-22' }),
          buildOverride({ shift_type: 'night' }),
        ],
        [buildScheduledShift({ date: '2026-04-21', shift_type: 'day' })]
      )
    ).toEqual([])
  })
})
