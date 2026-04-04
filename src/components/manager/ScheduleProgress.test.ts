import { describe, expect, it } from 'vitest'

import { computeProgress } from './ScheduleProgress'

describe('ScheduleProgress computations', () => {
  it('returns 0% with no shifts', () => {
    expect(computeProgress(0, 0).pct).toBe(0)
  })

  it('returns 100% when fully filled', () => {
    expect(computeProgress(21, 21).pct).toBe(100)
  })

  it('rounds correctly', () => {
    expect(computeProgress(18, 21).pct).toBe(86)
  })

  it('counts gaps correctly', () => {
    expect(computeProgress(15, 21).gaps).toBe(6)
  })

  it('never returns negative gaps', () => {
    expect(computeProgress(22, 21).gaps).toBe(0)
  })
})
