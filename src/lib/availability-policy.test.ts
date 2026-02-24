import { describe, expect, it } from 'vitest'

import {
  getAvailabilityEntryTypeForEmploymentType,
  normalizeEmploymentType,
} from '@/lib/availability-policy'

describe('availability policy', () => {
  it('maps full-time and part-time users to unavailable entries', () => {
    expect(getAvailabilityEntryTypeForEmploymentType('full_time')).toBe('unavailable')
    expect(getAvailabilityEntryTypeForEmploymentType('part_time')).toBe('unavailable')
  })

  it('maps PRN users to available entries', () => {
    expect(getAvailabilityEntryTypeForEmploymentType('prn')).toBe('available')
  })

  it('normalizes unknown employment types to full_time', () => {
    expect(normalizeEmploymentType('contractor')).toBe('full_time')
    expect(normalizeEmploymentType(null)).toBe('full_time')
    expect(normalizeEmploymentType(undefined)).toBe('full_time')
  })
})
