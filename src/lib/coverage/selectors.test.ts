import { describe, expect, it } from 'vitest'

import { countActive, countBy, flatten, shouldShowMonthTag } from '@/lib/coverage/selectors'
import type { DayItem, ShiftItem } from '@/lib/coverage/selectors'

// CoverageUiStatus values: 'active' | 'oncall' | 'leave_early' | 'cancelled'

function makeShift(overrides: Partial<ShiftItem> = {}): ShiftItem {
  return {
    id: 'shift-1',
    userId: 'user-1',
    name: 'Test User',
    status: 'active',
    log: [],
    ...overrides,
  }
}

function makeDay(overrides: Partial<DayItem> = {}): DayItem {
  return {
    id: 'day-1',
    isoDate: '2026-03-01',
    date: 1,
    label: 'Mar 1',
    dayStatus: 'draft',
    constraintBlocked: false,
    leadShift: null,
    staffShifts: [],
    ...overrides,
  }
}

describe('flatten', () => {
  it('returns lead first, then staff shifts', () => {
    const lead = makeShift({ id: 'lead-1', name: 'Lead' })
    const staff1 = makeShift({ id: 'staff-1', name: 'Staff A' })
    const staff2 = makeShift({ id: 'staff-2', name: 'Staff B' })
    const day = makeDay({ leadShift: lead, staffShifts: [staff1, staff2] })

    const result = flatten(day)
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ id: 'lead-1', isLead: true })
    expect(result[1]).toMatchObject({ id: 'staff-1', isLead: false })
    expect(result[2]).toMatchObject({ id: 'staff-2', isLead: false })
  })

  it('returns only staff when there is no lead', () => {
    const staff = makeShift({ id: 'staff-1' })
    const day = makeDay({ leadShift: null, staffShifts: [staff] })

    const result = flatten(day)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'staff-1', isLead: false })
  })

  it('returns empty array when day has no shifts', () => {
    const day = makeDay({ leadShift: null, staffShifts: [] })
    expect(flatten(day)).toEqual([])
  })
})

describe('countBy', () => {
  it('counts shifts matching the given status', () => {
    const lead = makeShift({ status: 'oncall' })
    const staff1 = makeShift({ status: 'oncall' })
    const staff2 = makeShift({ status: 'active' })
    const day = makeDay({ leadShift: lead, staffShifts: [staff1, staff2] })

    expect(countBy(day, 'oncall')).toBe(2)
    expect(countBy(day, 'active')).toBe(1)
  })

  it('returns 0 when no shifts match', () => {
    const day = makeDay({ staffShifts: [makeShift({ status: 'active' })] })
    expect(countBy(day, 'cancelled')).toBe(0)
  })

  it('includes the lead shift in the count', () => {
    const lead = makeShift({ status: 'cancelled' })
    const day = makeDay({ leadShift: lead, staffShifts: [] })
    expect(countBy(day, 'cancelled')).toBe(1)
  })
})

describe('countActive', () => {
  it('excludes cancelled shifts', () => {
    const lead = makeShift({ status: 'active' })
    const staff1 = makeShift({ status: 'cancelled' })
    const staff2 = makeShift({ status: 'oncall' })
    const day = makeDay({ leadShift: lead, staffShifts: [staff1, staff2] })

    expect(countActive(day)).toBe(2)
  })

  it('includes all non-cancelled statuses', () => {
    const day = makeDay({
      leadShift: makeShift({ status: 'active' }),
      staffShifts: [
        makeShift({ status: 'oncall' }),
        makeShift({ status: 'leave_early' }),
        makeShift({ status: 'active' }),
      ],
    })
    expect(countActive(day)).toBe(4)
  })

  it('returns 0 when all shifts are cancelled', () => {
    const day = makeDay({
      leadShift: makeShift({ status: 'cancelled' }),
      staffShifts: [makeShift({ status: 'cancelled' })],
    })
    expect(countActive(day)).toBe(0)
  })
})

describe('shouldShowMonthTag', () => {
  it('returns true for index 0 regardless of date', () => {
    expect(shouldShowMonthTag(0, '2026-03-15')).toBe(true)
  })

  it('returns true for the first day of a month', () => {
    expect(shouldShowMonthTag(5, '2026-03-01')).toBe(true)
    expect(shouldShowMonthTag(1, '2026-04-01')).toBe(true)
  })

  it('returns false for non-first-of-month dates after index 0', () => {
    expect(shouldShowMonthTag(1, '2026-03-15')).toBe(false)
    expect(shouldShowMonthTag(3, '2026-03-31')).toBe(false)
  })

  it('returns false for invalid date strings after index 0', () => {
    expect(shouldShowMonthTag(1, 'not-a-date')).toBe(false)
    expect(shouldShowMonthTag(2, '')).toBe(false)
  })
})
