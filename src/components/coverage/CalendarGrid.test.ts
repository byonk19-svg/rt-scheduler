import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getVisibleWeek, nextIndex, resolveSwipeDirection } from './CalendarGrid'

const calendarGridSource = readFileSync(
  resolve(process.cwd(), 'src/components/coverage/CalendarGrid.tsx'),
  'utf8'
)
const calendarGridMobileViewSource = readFileSync(
  resolve(process.cwd(), 'src/components/coverage/CalendarGridMobileView.tsx'),
  'utf8'
)
const calendarGridDesktopViewSource = readFileSync(
  resolve(process.cwd(), 'src/components/coverage/CalendarGridDesktopView.tsx'),
  'utf8'
)
const calendarGridDayCardSource = readFileSync(
  resolve(process.cwd(), 'src/components/coverage/CalendarGridDayCard.tsx'),
  'utf8'
)

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

describe('CalendarGrid framing', () => {
  it('keeps the mobile calendar shell in a dedicated component', () => {
    expect(calendarGridMobileViewSource).toContain('Prev week')
    expect(calendarGridMobileViewSource).toContain('Next week')
    expect(calendarGridSource).toContain('CalendarGridMobileView')
  })

  it('keeps the desktop calendar shell in a dedicated component', () => {
    expect(calendarGridDesktopViewSource).toContain('Coverage calendar')
    expect(calendarGridDesktopViewSource).toContain('Week {weekIndex + 1}')
    expect(calendarGridSource).toContain('CalendarGridDesktopView')
  })

  it('keeps the shared day-card rendering in a dedicated component', () => {
    expect(calendarGridDayCardSource).toContain('Open day editor')
    expect(calendarGridDayCardSource).toContain('No lead')
    expect(calendarGridSource).toContain('CalendarGridDayCard')
  })
})
