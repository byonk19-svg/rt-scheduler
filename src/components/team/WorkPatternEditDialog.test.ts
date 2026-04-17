import { describe, expect, it } from 'vitest'

import { validateWeekendAnchorDate } from '@/components/team/WorkPatternEditDialog'

describe('validateWeekendAnchorDate', () => {
  it('accepts Saturdays and rejects other days', () => {
    expect(validateWeekendAnchorDate('2026-04-18')).toBeNull()
    expect(validateWeekendAnchorDate('2026-04-17')).toBe('Weekend anchor date must be a Saturday.')
  })
})
