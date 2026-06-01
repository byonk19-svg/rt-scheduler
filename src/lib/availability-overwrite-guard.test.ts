import { describe, expect, it } from 'vitest'

import { findBlockingAvailabilityOverwrite } from './availability-overwrite-guard'

describe('findBlockingAvailabilityOverwrite', () => {
  it('allows same-source replacement for the same availability key', () => {
    expect(
      findBlockingAvailabilityOverwrite(
        [{ date: '2026-03-24', shift_type: 'both', source: 'therapist' }],
        [{ date: '2026-03-24', shift_type: 'both', source: 'therapist' }]
      )
    ).toBeNull()
  })

  it('blocks cross-source replacement for the same availability key', () => {
    expect(
      findBlockingAvailabilityOverwrite(
        [{ date: '2026-03-24', shift_type: 'both', source: 'therapist' }],
        [{ date: '2026-03-24', shift_type: 'both', source: 'manager' }]
      )
    ).toEqual({ date: '2026-03-24', shift_type: 'both', source: 'therapist' })
  })

  it('ignores rows with a different date or shift type', () => {
    expect(
      findBlockingAvailabilityOverwrite(
        [
          { date: '2026-03-24', shift_type: 'day', source: 'therapist' },
          { date: '2026-03-25', shift_type: 'both', source: 'therapist' },
        ],
        [{ date: '2026-03-24', shift_type: 'both', source: 'manager' }]
      )
    ).toBeNull()
  })
})
