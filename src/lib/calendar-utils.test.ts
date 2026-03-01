import { describe, expect, it } from 'vitest'

import {
  shiftMonthKey,
  toMonthEndKey,
  toMonthStartKey,
  formatMonthLabel,
} from '@/lib/calendar-utils'

// ---------------------------------------------------------------------------
// toMonthStartKey
// ---------------------------------------------------------------------------

describe('toMonthStartKey', () => {
  it('returns the first day of the month for a mid-month date', () => {
    expect(toMonthStartKey('2026-03-15')).toBe('2026-03-01')
  })

  it('is a no-op for a date already on the first of the month', () => {
    expect(toMonthStartKey('2026-03-01')).toBe('2026-03-01')
  })

  it('works for the last day of the month', () => {
    expect(toMonthStartKey('2026-01-31')).toBe('2026-01-01')
  })

  it('handles an invalid date string without throwing', () => {
    // falls back to the current month — just verify it is a well-formed YYYY-MM-01 string
    const result = toMonthStartKey('not-a-date')
    expect(result).toMatch(/^\d{4}-\d{2}-01$/)
  })
})

// ---------------------------------------------------------------------------
// toMonthEndKey
// ---------------------------------------------------------------------------

describe('toMonthEndKey', () => {
  it('returns Jan 31 for a 31-day month', () => {
    expect(toMonthEndKey('2026-01-01')).toBe('2026-01-31')
  })

  it('returns Apr 30 for a 30-day month', () => {
    expect(toMonthEndKey('2026-04-01')).toBe('2026-04-30')
  })

  it('returns Feb 28 for a non-leap year', () => {
    expect(toMonthEndKey('2026-02-01')).toBe('2026-02-28')
  })

  it('returns Feb 29 for a leap year', () => {
    expect(toMonthEndKey('2024-02-01')).toBe('2024-02-29')
  })

  it('returns Dec 31 for December', () => {
    expect(toMonthEndKey('2026-12-01')).toBe('2026-12-31')
  })
})

// ---------------------------------------------------------------------------
// shiftMonthKey
// ---------------------------------------------------------------------------

describe('shiftMonthKey', () => {
  it('advances forward by 1 month within the same year', () => {
    expect(shiftMonthKey('2026-03-01', 1)).toBe('2026-04-01')
  })

  it('advances forward across a Dec → Jan year boundary', () => {
    expect(shiftMonthKey('2026-12-01', 1)).toBe('2027-01-01')
  })

  it('goes back by 1 month within the same year', () => {
    expect(shiftMonthKey('2026-03-01', -1)).toBe('2026-02-01')
  })

  it('goes back across a Jan → Dec year boundary', () => {
    expect(shiftMonthKey('2026-01-01', -1)).toBe('2025-12-01')
  })

  it('advances by 0 months (identity)', () => {
    expect(shiftMonthKey('2026-06-01', 0)).toBe('2026-06-01')
  })
})

// ---------------------------------------------------------------------------
// formatMonthLabel
// ---------------------------------------------------------------------------

describe('formatMonthLabel', () => {
  it('returns "Month YYYY" for a valid date', () => {
    expect(formatMonthLabel('2026-03-01')).toBe('March 2026')
  })

  it('returns "Month YYYY" for a mid-month date (only month/year shown)', () => {
    expect(formatMonthLabel('2026-11-15')).toBe('November 2026')
  })

  it('returns the raw input for an invalid date string', () => {
    expect(formatMonthLabel('not-a-date')).toBe('not-a-date')
  })
})
