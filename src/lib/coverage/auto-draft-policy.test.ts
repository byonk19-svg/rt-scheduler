import { describe, expect, it } from 'vitest'

import { getAutoDraftCoveragePolicy } from '@/lib/coverage/auto-draft-policy'

describe('getAutoDraftCoveragePolicy', () => {
  it('uses 4 as ideal coverage while accepting 3 as minimum', () => {
    expect(getAutoDraftCoveragePolicy()).toEqual({
      idealCoveragePerShift: 4,
      minimumCoveragePerShift: 3,
    })
  })
})
