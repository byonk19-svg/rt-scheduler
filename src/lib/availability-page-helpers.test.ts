import { describe, expect, it } from 'vitest'

import {
  getCommonAvailabilityFeedback,
  getOne,
  getSearchParam,
} from '@/lib/availability-page-helpers'

describe('availability-page-helpers', () => {
  it('reads the first value from repeated search params', () => {
    expect(getSearchParam(['a', 'b'])).toBe('a')
    expect(getSearchParam('single')).toBe('single')
    expect(getSearchParam(undefined)).toBeUndefined()
  })

  it('normalizes joined row helpers from Supabase selects', () => {
    expect(getOne([{ id: 1 }, { id: 2 }])).toEqual({ id: 1 })
    expect(getOne({ id: 3 })).toEqual({ id: 3 })
    expect(getOne(null)).toBeNull()
  })

  it('returns the shared availability feedback states', () => {
    expect(getCommonAvailabilityFeedback({ success: 'draft_saved' })).toEqual({
      message: "Draft saved. Submit availability when you're ready.",
      variant: 'success',
    })

    expect(
      getCommonAvailabilityFeedback(
        { error: 'delete_failed' },
        { deleteFailedMessage: "Couldn't delete availability request." }
      )
    ).toEqual({
      message: "Couldn't delete availability request.",
      variant: 'error',
    })
  })
})
