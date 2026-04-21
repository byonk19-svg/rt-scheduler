import { describe, expect, it } from 'vitest'

import {
  buildAvailabilityHref,
  buildAvailabilityTabHref,
  getManagerAvailabilityFeedback,
  toAvailabilitySearchString,
} from '@/lib/availability-route-utils'

describe('availability-route-utils', () => {
  it('serializes route params into a search string', () => {
    expect(
      toAvailabilitySearchString({
        cycle: 'cycle-1',
        status: 'force_off',
      })
    ).toBe('?cycle=cycle-1&status=force_off')
  })

  it('builds planner and intake tab hrefs while preserving other params', () => {
    expect(buildAvailabilityTabHref({ cycle: 'cycle-1', search: 'Aleyce' }, 'planner')).toBe(
      '/availability?cycle=cycle-1&search=Aleyce&tab=planner'
    )
    expect(buildAvailabilityTabHref({ cycle: 'cycle-1', search: 'Aleyce' }, 'intake')).toBe(
      '/availability?cycle=cycle-1&search=Aleyce&tab=intake'
    )
  })

  it('builds updated availability hrefs and preserves anchors', () => {
    expect(
      buildAvailabilityHref({ cycle: 'cycle-1', tab: 'planner' }, { status: 'force_on' }, '#inbox')
    ).toBe('/availability?cycle=cycle-1&tab=planner&status=force_on#inbox')
  })

  it('returns manager-specific feedback beyond the common availability cases', () => {
    expect(getManagerAvailabilityFeedback({ success: 'planner_saved' })).toEqual({
      message: 'Planner dates saved.',
      variant: 'success',
    })
    expect(getManagerAvailabilityFeedback({ error: 'email_intake_match_failed' })).toEqual({
      message: "Couldn't save that match. Try again.",
      variant: 'error',
    })
  })
})
