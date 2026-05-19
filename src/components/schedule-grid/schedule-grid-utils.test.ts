import { describe, expect, it } from 'vitest'

import { buildDailyTotals, getCellDisplay, isWorkingScheduledGridCell } from './schedule-grid-utils'
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

  it('returns plain text data for a staff cell', () => {
    const cell: GridCell = {
      shiftId: 's2',
      status: 'staff',
      hasNeedsOff: false,
      isIneligible: false,
    }

    expect(getCellDisplay(cell).colorClass).toBe('text-foreground')
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
  it('counts only working scheduled lead and staff cells per date', () => {
    const rows: TherapistGridRow[] = [
      {
        userId: 'u1',
        name: 'A',
        isOnFmla: false,
        isActive: true,
        employmentType: 'full_time',
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
        employmentType: 'full_time',
        shiftType: 'day',
        cells: {
          '2026-05-04': {
            shiftId: 's2',
            status: 'staff',
            hasNeedsOff: false,
            isIneligible: false,
          },
          '2026-05-05': {
            shiftId: 's3',
            status: 'on_call',
            hasNeedsOff: false,
            isIneligible: false,
          },
        },
      },
      {
        userId: 'u3',
        name: 'C',
        isOnFmla: false,
        isActive: true,
        employmentType: 'prn',
        shiftType: 'day',
        cells: {
          '2026-05-04': {
            shiftId: 's4',
            status: 'call_in',
            hasNeedsOff: false,
            isIneligible: false,
          },
          '2026-05-05': {
            shiftId: 's5',
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

  it('does not treat operational status cells as working scheduled coverage', () => {
    for (const status of ['call_in', 'on_call', 'cancelled', 'left_early', 'off'] as const) {
      expect(
        isWorkingScheduledGridCell({
          shiftId: status === 'off' ? null : `shift-${status}`,
          status,
          hasNeedsOff: false,
          isIneligible: false,
        })
      ).toBe(false)
    }
  })
})
