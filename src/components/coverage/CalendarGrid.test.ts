import { describe, expect, it } from 'vitest'

import { getVisibleWeek, nextIndex, resolveSwipeDirection } from './CalendarGrid'
import { getCoverageHealth } from '@/lib/coverage/selectors'
import type { DayItem, ShiftItem } from '@/lib/coverage/selectors'

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
    label: 'Sun, Mar 1',
    dayStatus: 'published',
    constraintBlocked: false,
    leadShift: null,
    staffShifts: [],
    ...overrides,
  }
}

describe('CalendarGrid keyboard navigation index', () => {
  it('moves right by 1', () => {
    expect(nextIndex(0, 'ArrowRight', 42)).toBe(1)
  })

  it('clamps at end of row', () => {
    expect(nextIndex(41, 'ArrowRight', 42)).toBe(41)
  })

  it('moves left by 1', () => {
    expect(nextIndex(5, 'ArrowLeft', 42)).toBe(4)
  })

  it('clamps at start', () => {
    expect(nextIndex(0, 'ArrowLeft', 42)).toBe(0)
  })

  it('moves down one row (7 cols)', () => {
    expect(nextIndex(2, 'ArrowDown', 42)).toBe(9)
  })

  it('clamps ArrowDown at last cell', () => {
    expect(nextIndex(39, 'ArrowDown', 42)).toBe(41)
  })

  it('moves up one row', () => {
    expect(nextIndex(9, 'ArrowUp', 42)).toBe(2)
  })

  it('clamps ArrowUp at row 0', () => {
    expect(nextIndex(3, 'ArrowUp', 42)).toBe(0)
  })
})

describe('CalendarGrid mobile week helpers', () => {
  it('returns the requested visible week and clamps out-of-range offsets', () => {
    const weeks = [
      ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      ['h', 'i'],
    ]

    expect(getVisibleWeek(weeks, 0)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
    expect(getVisibleWeek(weeks, 1)).toEqual(['h', 'i'])
    expect(getVisibleWeek(weeks, 99)).toEqual(['h', 'i'])
  })

  it('detects left and right swipe gestures with a 50px threshold', () => {
    expect(resolveSwipeDirection(150, 80)).toBe('left')
    expect(resolveSwipeDirection(80, 150)).toBe('right')
    expect(resolveSwipeDirection(100, 70)).toBeNull()
    expect(resolveSwipeDirection(null, 70)).toBeNull()
  })
})

describe('coverage health helpers', () => {
  it('keeps active staffing critical when assigned rows include non-active statuses', () => {
    const health = getCoverageHealth(
      makeDay({
        leadShift: makeShift({ id: 'lead-1', userId: 'lead-1', name: 'Lead One', status: 'active' }),
        staffShifts: [
          makeShift({ id: 'staff-1', userId: 'staff-1', name: 'Staff One', status: 'active' }),
          makeShift({
            id: 'staff-2',
            userId: 'staff-2',
            name: 'Staff Two',
            status: 'cancelled',
          }),
          makeShift({ id: 'staff-3', userId: 'staff-3', name: 'Staff Three', status: 'call_in' }),
        ],
      })
    )

    expect(health.activeCount).toBe(2)
    expect(health.assignedCount).toBe(4)
    expect(health.tone).toBe('critical')
    expect(health.activeStaffingLabel).toBe('2/4 active staffing')
    expect(health.assignedRowsLabel).toBe('4/5 assigned rows')
    expect(health.statusLabel).toBe('2 gaps')
  })

  it('marks assigned but non-active shifts as unstaffed instead of healthy', () => {
    const health = getCoverageHealth(
      makeDay({
        leadShift: makeShift({
          id: 'lead-1',
          userId: 'lead-1',
          name: 'Lead One',
          status: 'cancelled',
        }),
        staffShifts: [
          makeShift({ id: 'staff-1', userId: 'staff-1', name: 'Staff One', status: 'cancelled' }),
          makeShift({ id: 'staff-2', userId: 'staff-2', name: 'Staff Two', status: 'call_in' }),
        ],
      })
    )

    expect(health.activeCount).toBe(0)
    expect(health.assignedCount).toBe(3)
    expect(health.tone).toBe('critical')
    expect(health.activeStaffingLabel).toBe('0/4 active staffing')
    expect(health.assignedRowsLabel).toBe('3/5 assigned rows')
    expect(health.statusLabel).toBe('Unstaffed')
  })

  it('keeps no-lead days unstaffed when nobody active is left on the shift', () => {
    const health = getCoverageHealth(
      makeDay({
        leadShift: null,
        staffShifts: [makeShift({ id: 'staff-1', userId: 'staff-1', status: 'cancelled' })],
      })
    )

    expect(health.activeCount).toBe(0)
    expect(health.assignedCount).toBe(1)
    expect(health.tone).toBe('critical')
    expect(health.statusLabel).toBe('Unstaffed')
  })
})
