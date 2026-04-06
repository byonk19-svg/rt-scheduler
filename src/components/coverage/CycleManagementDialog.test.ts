import { describe, expect, it } from 'vitest'

import { buildCycleDraft } from './CycleManagementDialog'

describe('CycleManagementDialog cycle draft defaults', () => {
  it('starts the next cycle the day after the latest cycle ends', () => {
    expect(buildCycleDraft('2026-05-10', '2026-04-04')).toEqual({
      label: 'May 11 - Jun 21',
      startDate: '2026-05-11',
      endDate: '2026-06-21',
    })
  })

  it('falls back to the provided start date when there is no previous cycle', () => {
    expect(buildCycleDraft(null, '2026-04-04')).toEqual({
      label: 'Apr 4 - May 15',
      startDate: '2026-04-04',
      endDate: '2026-05-15',
    })
  })
})
