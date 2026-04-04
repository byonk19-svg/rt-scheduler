import { describe, expect, it } from 'vitest'

import { nextIndex } from './CalendarGrid'

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
