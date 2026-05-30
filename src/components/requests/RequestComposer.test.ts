import { describe, expect, it } from 'vitest'

import {
  getVisibleShiftChoices,
  MAX_VISIBLE_SHIFT_CHOICES,
} from '@/components/requests/RequestComposer'
import type { MyShift } from '@/components/requests/request-page-model'

function makeShift(index: number): MyShift {
  return {
    id: `shift-${index}`,
    isoDate: `2026-06-${String(index).padStart(2, '0')}`,
    date: `Jun ${index}`,
    dow: 'Monday',
    type: index % 2 === 0 ? 'Night' : 'Day',
    shiftType: index % 2 === 0 ? 'night' : 'day',
    isLead: false,
  }
}

describe('getVisibleShiftChoices', () => {
  const shifts = Array.from({ length: 14 }, (_value, index) => makeShift(index + 1))

  it('limits the initial shift row to a scannable set', () => {
    const visible = getVisibleShiftChoices(shifts, null, false)

    expect(visible).toHaveLength(MAX_VISIBLE_SHIFT_CHOICES)
    expect(visible.map((shift) => shift.id)).toEqual(
      shifts.slice(0, MAX_VISIBLE_SHIFT_CHOICES).map((shift) => shift.id)
    )
  })

  it('keeps a selected shift visible even when it is outside the initial set', () => {
    const visible = getVisibleShiftChoices(shifts, 'shift-13', false)

    expect(visible).toHaveLength(MAX_VISIBLE_SHIFT_CHOICES)
    expect(visible.map((shift) => shift.id)).toContain('shift-13')
    expect(visible.at(-1)?.id).toBe('shift-13')
  })

  it('returns every eligible shift when the user asks to show all shifts', () => {
    const visible = getVisibleShiftChoices(shifts, 'shift-13', true)

    expect(visible.map((shift) => shift.id)).toEqual(shifts.map((shift) => shift.id))
  })
})
