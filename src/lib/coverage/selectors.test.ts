import { describe, expect, it } from 'vitest'

import {
  buildDayItems,
  countActive,
  countBy,
  flatten,
  shouldShowMonthTag,
  toUiStatus,
} from '@/lib/coverage/selectors'
import type { BuildDayRowInput, DayItem, ShiftItem } from '@/lib/coverage/selectors'

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

// ---------------------------------------------------------------------------
// toUiStatus
// ---------------------------------------------------------------------------

describe('toUiStatus', () => {
  it('maps on_call assignment → oncall regardless of base status', () => {
    expect(toUiStatus('on_call', 'scheduled')).toBe('oncall')
  })

  it('maps left_early assignment → leave_early', () => {
    expect(toUiStatus('left_early', 'scheduled')).toBe('leave_early')
  })

  it('maps call_in assignment → cancelled', () => {
    expect(toUiStatus('call_in', 'scheduled')).toBe('cancelled')
  })

  it('maps cancelled assignment → cancelled', () => {
    expect(toUiStatus('cancelled', 'scheduled')).toBe('cancelled')
  })

  it('maps scheduled assignment → active (overrides base status)', () => {
    expect(toUiStatus('scheduled', 'on_call')).toBe('active')
  })

  it('falls back to base status on_call when assignment is null', () => {
    expect(toUiStatus(null, 'on_call')).toBe('oncall')
  })

  it('falls back to base status sick → cancelled when assignment is null', () => {
    expect(toUiStatus(null, 'sick')).toBe('cancelled')
  })

  it('falls back to base status called_off → cancelled when assignment is null', () => {
    expect(toUiStatus(null, 'called_off')).toBe('cancelled')
  })

  it('returns active when no assignment and status is scheduled', () => {
    expect(toUiStatus(null, 'scheduled')).toBe('active')
  })
})

// ---------------------------------------------------------------------------
// buildDayItems
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<BuildDayRowInput> & { id: string }): BuildDayRowInput {
  return {
    user_id: overrides.id,
    date: '2026-03-01',
    shift_type: 'day',
    role: 'staff',
    status: 'scheduled',
    assignment_status: null,
    name: 'Test Therapist',
    ...overrides,
  }
}

const START = '2026-03-01'
const END = '2026-03-03'

describe('buildDayItems', () => {
  it('returns one DayItem per date in the range', () => {
    const items = buildDayItems('day', [], START, END, new Set())
    expect(items).toHaveLength(3)
    expect(items.map((d) => d.isoDate)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03'])
  })

  it('empty day has dayStatus missing_lead and no shifts', () => {
    const [item] = buildDayItems('day', [], START, START, new Set())
    expect(item.leadShift).toBeNull()
    expect(item.staffShifts).toHaveLength(0)
    expect(item.dayStatus).toBe('missing_lead')
  })

  it('ignores rows for a different shift_type', () => {
    const nightRow = makeRow({ id: 'n1', shift_type: 'night', date: START })
    const [item] = buildDayItems('day', [nightRow], START, START, new Set())
    expect(item.leadShift).toBeNull()
    expect(item.staffShifts).toHaveLength(0)
  })

  it('lead row populates leadShift; dayStatus becomes published', () => {
    const lead = makeRow({ id: 'l1', role: 'lead', name: 'Alice Lead', date: START })
    const [item] = buildDayItems('day', [lead], START, START, new Set())
    expect(item.leadShift?.name).toBe('Alice Lead')
    expect(item.leadShift?.id).toBe('l1')
    expect(item.staffShifts).toHaveLength(0)
    expect(item.dayStatus).toBe('published')
  })

  it('staff rows are sorted alphabetically', () => {
    const lead = makeRow({ id: 'l', role: 'lead', name: 'Lead', date: START })
    const staffZ = makeRow({ id: 'sz', role: 'staff', name: 'Zara', date: START })
    const staffB = makeRow({ id: 'sb', role: 'staff', name: 'Bob', date: START })
    const [item] = buildDayItems('day', [staffZ, staffB, lead], START, START, new Set())
    expect(item.staffShifts.map((s) => s.name)).toEqual(['Bob', 'Zara'])
  })

  it('constraintBlocked is true when the slot key is in the set', () => {
    const blocked = new Set(['2026-03-01:day'])
    const [item] = buildDayItems('day', [], START, START, blocked)
    expect(item.constraintBlocked).toBe(true)
  })

  it('constraintBlocked is false when the slot key is absent', () => {
    const [item] = buildDayItems('day', [], START, START, new Set())
    expect(item.constraintBlocked).toBe(false)
  })

  it('dayStatus is override when any row has called_off status', () => {
    const lead = makeRow({ id: 'l', role: 'lead', name: 'Lead', date: START, status: 'called_off' })
    const [item] = buildDayItems('day', [lead], START, START, new Set())
    expect(item.dayStatus).toBe('override')
  })

  it('dayStatus is draft when any row has sick status (no called_off)', () => {
    const lead = makeRow({ id: 'l', role: 'lead', name: 'Lead', date: START, status: 'sick' })
    const [item] = buildDayItems('day', [lead], START, START, new Set())
    expect(item.dayStatus).toBe('draft')
  })

  it('applies toUiStatus for assignment_status mapping', () => {
    const lead = makeRow({ id: 'l', role: 'lead', date: START, assignment_status: 'on_call' })
    const [item] = buildDayItems('day', [lead], START, START, new Set())
    expect(item.leadShift?.status).toBe('oncall')
  })

  it('each new shift has an empty log array', () => {
    const lead = makeRow({ id: 'l', role: 'lead', date: START })
    const [item] = buildDayItems('day', [lead], START, START, new Set())
    expect(item.leadShift?.log).toEqual([])
  })

  it('userId is set from user_id', () => {
    const lead = makeRow({ id: 'l', user_id: 'uid-abc', role: 'lead', date: START })
    const [item] = buildDayItems('day', [lead], START, START, new Set())
    expect(item.leadShift?.userId).toBe('uid-abc')
  })
})
