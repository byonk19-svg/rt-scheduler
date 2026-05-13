import { describe, expect, it } from 'vitest'

import { buildDailyTotals, getCellDisplay } from './schedule-grid-utils'
import type { GridCell, TherapistGridRow } from './schedule-grid-types'

describe('getCellDisplay', () => {
  it('returns yellow chip data for a lead cell', () => {
    const cell: GridCell = {
      shiftId: 's1',
      status: 'lead',
      hasNeedsOff: false,
      isIneligible: false,
    }

    const display = getCellDisplay(cell)

    expect(display.code).toBe('1')
    expect(display.colorClass).toContain('bg-yellow')
    expect(display.asterisk).toBe(false)
  })

  it('returns blue chip data for a staff cell', () => {
    const cell: GridCell = {
      shiftId: 's2',
      status: 'staff',
      hasNeedsOff: false,
      isIneligible: false,
    }

    expect(getCellDisplay(cell).colorClass).toContain('bg-blue')
  })

  it('marks needs-off cells with an asterisk flag without blocking display', () => {
    const cell: GridCell = {
      shiftId: null,
      status: 'off',
      hasNeedsOff: true,
      isIneligible: false,
    }

    const display = getCellDisplay(cell)

    expect(display.asterisk).toBe(true)
    expect(display.code).toBe('·')
  })

  it('returns the expected code for each operational status', () => {
    const cases: Array<[GridCell['status'], string]> = [
      ['on_call', 'OC'],
      ['cancelled', 'CX'],
      ['call_in', 'CI'],
      ['left_early', 'LE'],
      ['off', '·'],
    ]

    for (const [status, expectedCode] of cases) {
      const cell: GridCell = { shiftId: null, status, hasNeedsOff: false, isIneligible: false }
      expect(getCellDisplay(cell).code).toBe(expectedCode)
    }
  })
})

describe('buildDailyTotals', () => {
  it('counts scheduled, lead, and call-in shifts per date', () => {
    const rows: TherapistGridRow[] = [
      {
        userId: 'u1',
        name: 'A',
        isOnFmla: false,
        isActive: true,
        shiftType: 'day',
        cells: {
          '2026-05-04': { shiftId: 's1', status: 'lead', hasNeedsOff: false, isIneligible: false },
          '2026-05-05': { shiftId: null, status: 'off', hasNeedsOff: false, isIneligible: false },
        },
      },
      {
        userId: 'u2',
        name: 'B',
        isOnFmla: false,
        isActive: true,
        shiftType: 'day',
        cells: {
          '2026-05-04': {
            shiftId: 's2',
            status: 'call_in',
            hasNeedsOff: false,
            isIneligible: false,
          },
          '2026-05-05': {
            shiftId: 's3',
            status: 'cancelled',
            hasNeedsOff: false,
            isIneligible: false,
          },
        },
      },
    ]

    expect(buildDailyTotals(rows, ['2026-05-04', '2026-05-05'])).toEqual({
      '2026-05-04': 2,
      '2026-05-05': 0,
    })
  })
})
