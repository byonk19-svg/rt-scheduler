import { describe, expect, it } from 'vitest'

import { findScheduledConflicts } from '@/lib/availability-scheduled-conflict'

describe('findScheduledConflicts', () => {
  it('returns a conflict when force off matches a scheduled shift on the same date', () => {
    expect(
      findScheduledConflicts(
        [{ date: '2026-04-21', shift_type: 'day', override_type: 'force_off' }],
        [{ date: '2026-04-21', shift_type: 'day' }]
      )
    ).toEqual([{ date: '2026-04-21', shiftType: 'day' }])
  })

  it('treats both-shift force off overrides as conflicting with any scheduled shift that day', () => {
    expect(
      findScheduledConflicts(
        [{ date: '2026-04-21', shift_type: 'both', override_type: 'force_off' }],
        [{ date: '2026-04-21', shift_type: 'night' }]
      )
    ).toEqual([{ date: '2026-04-21', shiftType: 'both' }])
  })

  it('ignores force-on overrides and non-matching shift/date combinations', () => {
    expect(
      findScheduledConflicts(
        [
          { date: '2026-04-21', shift_type: 'day', override_type: 'force_on' },
          { date: '2026-04-22', shift_type: 'day', override_type: 'force_off' },
          { date: '2026-04-21', shift_type: 'night', override_type: 'force_off' },
        ],
        [{ date: '2026-04-21', shift_type: 'day' }]
      )
    ).toEqual([])
  })
})
