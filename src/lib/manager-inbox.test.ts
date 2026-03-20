import { describe, expect, it } from 'vitest'

import { getNextCyclePlanningWindow } from '@/lib/manager-inbox'

describe('getNextCyclePlanningWindow', () => {
  it('derives the planning start and publish-by dates from the next 6-week cycle', () => {
    expect(getNextCyclePlanningWindow('2026-04-28')).toEqual({
      collectAvailabilityOn: '2026-03-17',
      publishBy: '2026-04-27',
    })
  })

  it('returns null planning dates when there is no next cycle', () => {
    expect(getNextCyclePlanningWindow(null)).toEqual({
      collectAvailabilityOn: null,
      publishBy: null,
    })
  })
})
