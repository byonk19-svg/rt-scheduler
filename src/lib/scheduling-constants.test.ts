import { describe, expect, it } from 'vitest'

import {
  getDefaultWeeklyLimitForEmploymentType,
  getWeeklyMinimumForEmploymentType,
  sanitizeWeeklyLimit,
} from '@/lib/scheduling-constants'

describe('scheduling constants helpers', () => {
  it('sets default weekly limits by employment type', () => {
    expect(getDefaultWeeklyLimitForEmploymentType('full_time')).toBe(3)
    expect(getDefaultWeeklyLimitForEmploymentType(null)).toBe(3)
    expect(getDefaultWeeklyLimitForEmploymentType('part_time')).toBe(2)
    expect(getDefaultWeeklyLimitForEmploymentType('prn')).toBe(1)
  })

  it('sanitizes weekly limits with a bounded fallback', () => {
    expect(sanitizeWeeklyLimit(4.9, 3)).toBe(4)
    expect(sanitizeWeeklyLimit(0, 3)).toBe(3)
    expect(sanitizeWeeklyLimit(8, 3)).toBe(3)
    expect(sanitizeWeeklyLimit(Number.NaN, 3)).toBe(3)
  })

  it('requires a weekly minimum only for full-time defaults', () => {
    expect(getWeeklyMinimumForEmploymentType('full_time')).toBe(3)
    expect(getWeeklyMinimumForEmploymentType(null)).toBe(3)
    expect(getWeeklyMinimumForEmploymentType(undefined)).toBe(3)
    expect(getWeeklyMinimumForEmploymentType('part_time')).toBe(0)
    expect(getWeeklyMinimumForEmploymentType('prn')).toBe(0)
  })
})
