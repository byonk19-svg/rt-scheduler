import { describe, expect, it } from 'vitest'

import {
  expandMonthDayRange,
  extractPtoRowDates,
  isPtoFormText,
  parsePtoForm,
  resolveSingleDateToken,
} from '@/lib/pto-form-parser'

// Cycles covering May–June 2026
const MAY_CYCLE = {
  id: 'cycle-may',
  label: 'May–June',
  start_date: '2026-04-27',
  end_date: '2026-06-13',
}
const cycles = [MAY_CYCLE]

// ---------------------------------------------------------------------------
// isPtoFormText
// ---------------------------------------------------------------------------

describe('isPtoFormText', () => {
  it('detects the PTO REQUEST/EDIT FORM title', () => {
    expect(isPtoFormText('PTO REQUEST/EDIT FORM\nEmployee Name: Jane Doe')).toBe(true)
  })

  it('detects forms with Employee Name + Employee Signature headers (no title)', () => {
    expect(
      isPtoFormText('Employee Name: Jane Doe\nMay 5\nEmployee Signature: Jane Doe\nDate: 4/1/26')
    ).toBe(true)
  })

  it('returns false for plain availability email text', () => {
    expect(isPtoFormText('Need off Mar 24, Can work Mar 28')).toBe(false)
  })

  it('returns false for partial match (only Employee Name, no signature)', () => {
    expect(isPtoFormText('Employee Name: Jane Doe\nNeed off May 5')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// resolveSingleDateToken
// ---------------------------------------------------------------------------

describe('resolveSingleDateToken', () => {
  it('resolves M/D to ISO via cycle year', () => {
    expect(resolveSingleDateToken('5/10', cycles)).toBe('2026-05-10')
  })

  it('resolves Month D to ISO via cycle year', () => {
    expect(resolveSingleDateToken('May 4', cycles)).toBe('2026-05-04')
  })

  it('resolves Month Dth (ordinal) to ISO', () => {
    expect(resolveSingleDateToken('May 4th', cycles)).toBe('2026-05-04')
  })

  it('resolves Month D YYYY (no comma) to ISO', () => {
    expect(resolveSingleDateToken('May 24 2026', cycles)).toBe('2026-05-24')
  })

  it('resolves M/D/YY to ISO', () => {
    expect(resolveSingleDateToken('5/10/26', cycles)).toBe('2026-05-10')
  })

  it('passes through an ISO date unchanged', () => {
    expect(resolveSingleDateToken('2026-05-16', cycles)).toBe('2026-05-16')
  })

  it('returns null for a token with no month context', () => {
    expect(resolveSingleDateToken('next Friday', cycles)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// expandMonthDayRange
// ---------------------------------------------------------------------------

describe('expandMonthDayRange', () => {
  it('expands a slash range within the same month', () => {
    expect(expandMonthDayRange(5, 3, 5, 5, cycles)).toEqual([
      '2026-05-03',
      '2026-05-04',
      '2026-05-05',
    ])
  })

  it('expands a cross-month range', () => {
    const result = expandMonthDayRange(5, 29, 6, 1, cycles)
    expect(result).toEqual(['2026-05-29', '2026-05-30', '2026-05-31', '2026-06-01'])
  })

  it('returns [] when the range exceeds 60 days', () => {
    expect(expandMonthDayRange(4, 1, 6, 15, cycles)).toEqual([])
  })

  it('returns [] when the start cannot be resolved to a cycle', () => {
    expect(expandMonthDayRange(1, 1, 1, 5, cycles)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// extractPtoRowDates
// ---------------------------------------------------------------------------

describe('extractPtoRowDates', () => {
  it('parses a single M/D date', () => {
    expect(extractPtoRowDates('5/10', cycles)).toEqual(['2026-05-10'])
  })

  it('parses an ordinal month date', () => {
    expect(extractPtoRowDates('May 4th', cycles)).toEqual(['2026-05-04'])
  })

  it('parses ampersand-separated list', () => {
    expect(extractPtoRowDates('5/3 & 5/4', cycles)).toEqual(['2026-05-03', '2026-05-04'])
  })

  it('parses comma-separated list', () => {
    expect(extractPtoRowDates('5/6, 5/7', cycles)).toEqual(['2026-05-06', '2026-05-07'])
  })

  it('parses a slash range (5/3 - 5/5)', () => {
    expect(extractPtoRowDates('5/3 - 5/5', cycles)).toEqual([
      '2026-05-03',
      '2026-05-04',
      '2026-05-05',
    ])
  })

  it('parses a "thru" slash range', () => {
    expect(extractPtoRowDates('5/29 thru 6/1', cycles)).toEqual([
      '2026-05-29',
      '2026-05-30',
      '2026-05-31',
      '2026-06-01',
    ])
  })

  it('parses a "through" month-name range', () => {
    expect(extractPtoRowDates('May 14 through May 18', cycles)).toEqual([
      '2026-05-14',
      '2026-05-15',
      '2026-05-16',
      '2026-05-17',
      '2026-05-18',
    ])
  })

  it('parses a cross-month range (May 3 - June 13)', () => {
    // 42 days — over the 60-day safety cap would not apply; 3 May to 13 June = 41 days
    const result = extractPtoRowDates('May 3 - June 13', cycles)
    expect(result[0]).toBe('2026-05-03')
    expect(result[result.length - 1]).toBe('2026-06-13')
    expect(result.length).toBe(42) // inclusive
  })

  it('parses a compact month range (May 23-26)', () => {
    expect(extractPtoRowDates('May 23-26', cycles)).toEqual([
      '2026-05-23',
      '2026-05-24',
      '2026-05-25',
      '2026-05-26',
    ])
  })

  it('parses multiple compact ranges separated by dashes (Audbriana pattern)', () => {
    const result = extractPtoRowDates('May 10th - May 23-26th - May 29-31st - June 12-14th', cycles)
    expect(result).toContain('2026-05-10')
    expect(result).toContain('2026-05-23')
    expect(result).toContain('2026-05-26')
    expect(result).toContain('2026-05-29')
    expect(result).toContain('2026-05-31')
    expect(result).toContain('2026-06-12')
    expect(result).toContain('2026-06-14')
  })

  it('parses individual dates with year (May 24 2026)', () => {
    expect(extractPtoRowDates('May 24 2026', cycles)).toEqual(['2026-05-24'])
  })

  it('returns [] for a line with no date content', () => {
    expect(extractPtoRowDates('out of town and daughter graduation', cycles)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// parsePtoForm — per-employee form blocks
// ---------------------------------------------------------------------------

describe('parsePtoForm', () => {
  it('parses bare off dates from a minimal PTO form', () => {
    const text = [
      'PTO REQUEST/EDIT FORM',
      'Employee Name: Brianna Yonkin',
      'Department: Resp.',
      'Date PTO Hours LT Sick Hours Jury Hours Bereavement Hours',
      '5/10',
      '5/16',
      '5/24',
      'Employee Signature: Brianna Yonkin',
      'Date: 4/8/26',
    ].join('\n')

    const result = parsePtoForm(text, cycles)
    expect(result.requests.map((r) => r.date)).toEqual(['2026-05-10', '2026-05-16', '2026-05-24'])
    expect(result.requests.every((r) => r.override_type === 'force_off')).toBe(true)
  })

  it('marks WORK rows as force_on', () => {
    const text = [
      'Employee Name: Barbara Cummings',
      'Employee Signature: B. Cummings',
      'Date PTO Hours LT Sick Hours',
      '5/10 WORK',
      '5/11 Work',
      'Employee Signature: B. Cummings',
      'Date: 2/18/26',
    ].join('\n')

    const result = parsePtoForm(text, cycles)
    expect(result.requests.every((r) => r.override_type === 'force_on')).toBe(true)
    expect(result.requests.map((r) => r.date)).toEqual(['2026-05-10', '2026-05-11'])
  })

  it('parses off dates in rows that contain "will work rest of week"', () => {
    const text = [
      'Employee Name: Ruth Guandique',
      'Department: Resp. Care',
      '5/3 - 5/5 off will work rest of week',
      '5/9 - 5/10 off',
      '5/29 off',
      'Employee Signature: Ruth Guandique',
      'Date: 3/25/26',
    ].join('\n')

    const result = parsePtoForm(text, cycles)
    const dates = result.requests.map((r) => r.date)
    expect(dates).toContain('2026-05-03')
    expect(dates).toContain('2026-05-04')
    expect(dates).toContain('2026-05-05')
    expect(dates).toContain('2026-05-09')
    expect(dates).toContain('2026-05-10')
    expect(dates).toContain('2026-05-29')
    expect(result.requests.every((r) => r.override_type === 'force_off')).toBe(true)
  })

  it('marks a "working" date as force_on', () => {
    const text = [
      'Employee Name: Ruth Guandique',
      '5/14 working memorial',
      'Employee Signature: Ruth Guandique',
      'Date: 3/25/26',
    ].join('\n')

    const result = parsePtoForm(text, cycles)
    expect(result.requests).toEqual([
      expect.objectContaining({ date: '2026-05-14', override_type: 'force_on' }),
    ])
  })

  it('strips day-of-week prefix and parses correctly', () => {
    const text = [
      'Employee Name: Aleyce',
      'Mon: off 5/3 & 5/4 out of town',
      'Wed: off 5/12 for Drs Appt',
      'Employee Signature: Aleyce Lariviere',
      'Date: 4/7/26',
    ].join('\n')

    const result = parsePtoForm(text, cycles)
    expect(result.requests.map((r) => r.date)).toEqual(['2026-05-03', '2026-05-04', '2026-05-12'])
    expect(result.requests.every((r) => r.override_type === 'force_off')).toBe(true)
  })

  it('ignores signature Date: line and does not parse it as a request', () => {
    const text = [
      'Employee Name: Nicole Getty',
      '5/16 off',
      'Employee Signature: Nicole Getty',
      'Date: 3/16/26',
    ].join('\n')

    const result = parsePtoForm(text, cycles)
    expect(result.requests).toHaveLength(1)
    expect(result.requests[0].date).toBe('2026-05-16')
  })

  it('parses "thru" range (Nicole Getty)', () => {
    const text = [
      'Employee Name: Nicole Getty',
      '5/29 thru 6/1 off',
      'Employee Signature: Nicole Getty',
      'Date: 3/17/26',
    ].join('\n')

    const result = parsePtoForm(text, cycles)
    expect(result.requests.map((r) => r.date)).toEqual([
      '2026-05-29',
      '2026-05-30',
      '2026-05-31',
      '2026-06-01',
    ])
  })

  it('parses Matt Wenzelburger "Work Month D" rows', () => {
    const text = [
      'Employee Name: Matt Wenzelburger',
      'Department: Resp',
      'Work May 16',
      'Work May 30',
      'Work June 13',
      'Employee Signature: Matt Wenzelburger',
      'Date: 4-11-26',
    ].join('\n')

    const result = parsePtoForm(text, cycles)
    expect(result.requests.every((r) => r.override_type === 'force_on')).toBe(true)
    expect(result.requests.map((r) => r.date)).toEqual(['2026-05-16', '2026-05-30', '2026-06-13'])
  })

  it('parses Julie Cooper cruise dates (individual rows with year)', () => {
    const text = [
      'Employee Name: Julie Cooper',
      'Department: Respiratory',
      'May 24 2026',
      'May 25 2026',
      'May 26 2026',
      'May 22 2026',
      'May 23 2026',
      'Comments: Cruise for Daughter graduation',
      'Employee Signature: Julie Cooper',
      'Date: 2/15/2026',
    ].join('\n')

    const result = parsePtoForm(text, cycles)
    expect(result.requests.map((r) => r.date)).toEqual([
      '2026-05-22',
      '2026-05-23',
      '2026-05-24',
      '2026-05-25',
      '2026-05-26',
    ])
  })

  it('parses Audbriana compound date list', () => {
    const text = [
      'Employee Name: Audbriana W. Carr',
      'May 10th - May 23-26th - May 29-31st - June 12-14th',
      'Employee Signature: Audbriana W. Carr',
      'Date: 04/11/2026',
    ].join('\n')

    const result = parsePtoForm(text, cycles)
    const dates = result.requests.map((r) => r.date)
    expect(dates).toContain('2026-05-10')
    expect(dates).toContain('2026-05-23')
    expect(dates).toContain('2026-05-26')
    expect(dates).toContain('2026-05-29')
    expect(dates).toContain('2026-05-31')
    expect(dates).toContain('2026-06-12')
    expect(dates).toContain('2026-06-14')
    expect(result.requests.every((r) => r.override_type === 'force_off')).toBe(true)
  })

  it('flags weekday recurrence lines (no calendar dates) as unresolvedLines', () => {
    const text = [
      'Employee Name: Kim Suarez',
      'off Tuesday + Wednesdays',
      'off May 10th',
      'Employee Signature: KSL',
      'Date: 4/6/26',
    ].join('\n')

    const result = parsePtoForm(text, cycles)
    expect(result.unresolvedLines).toContain('off Tuesday + Wednesdays')
    // The explicit date still parses
    expect(result.requests.some((r) => r.date === '2026-05-10')).toBe(true)
  })

  it('ignores table header lines', () => {
    const text = [
      'Employee Name: Jane Doe',
      'Date PTO Hours LT Sick Hours Jury Hours Bereavement Hours',
      '5/16 off',
      'Employee Signature: Jane Doe',
      'Date: 4/1/26',
    ].join('\n')

    const result = parsePtoForm(text, cycles)
    expect(result.requests).toHaveLength(1)
    expect(result.requests[0].date).toBe('2026-05-16')
  })

  it('returns needs_review status when unresolved lines are present', () => {
    const text = [
      'Employee Name: Kim Suarez',
      'off Tuesday + Wednesdays',
      'off May 10th',
      'Employee Signature: KSL',
      'Date: 4/6/26',
    ].join('\n')

    expect(parsePtoForm(text, cycles).status).toBe('needs_review')
  })

  it('returns parsed status for a fully-resolved single-cycle form', () => {
    const text = [
      'Employee Name: Aleyce Lariviere',
      'off 5/3 & 5/4 please',
      'Employee Signature: Aleyce Lariviere',
      'Date: 4/3/26',
    ].join('\n')

    expect(parsePtoForm(text, cycles).status).toBe('parsed')
  })
})
