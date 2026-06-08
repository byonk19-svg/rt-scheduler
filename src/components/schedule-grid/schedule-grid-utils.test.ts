import { describe, expect, it } from 'vitest'

import {
  buildDailyTotals,
  buildScheduleCellAccessibleLabel,
  getCellDisplay,
  isWorkingScheduledGridCell,
} from './schedule-grid-utils'
import type { GridCell, TherapistGridRow } from './schedule-grid-types'

describe('getCellDisplay', () => {
  it('returns polished yellow chip data for a lead cell', () => {
    const cell: GridCell = {
      shiftId: 's1',
      status: 'lead',
      hasNeedsOff: false,
      isIneligible: false,
    }

    const display = getCellDisplay(cell)

    expect(display.code).toBe('1')
    expect(display.colorClass).toContain('bg-yellow')
    expect(display.colorClass).toContain('border-yellow')
    expect(display.asterisk).toBe(false)
  })

  it('returns plain printed-cell data for a staff cell', () => {
    const cell: GridCell = {
      shiftId: 's2',
      status: 'staff',
      hasNeedsOff: false,
      isIneligible: false,
    }

    expect(getCellDisplay(cell).colorClass).toBe('text-[var(--print-ink)]')
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
    expect(display.code).toBe('.')
  })

  it('returns the expected code for each operational status', () => {
    const cases: Array<[GridCell['status'], string]> = [
      ['on_call', 'OC'],
      ['cancelled', 'CX'],
      ['call_in', 'CI'],
      ['left_early', 'LE'],
      ['off', '.'],
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

describe('buildScheduleCellAccessibleLabel', () => {
  it('builds a readable label for a clickable scheduled staff cell', () => {
    expect(
      buildScheduleCellAccessibleLabel({
        therapistName: 'Alice Johnson',
        date: '2026-05-04',
        shiftType: 'day',
        cell: {
          shiftId: 's1',
          status: 'staff',
          hasNeedsOff: false,
          isIneligible: false,
        },
        canOpenActions: true,
      })
    ).toBe('Alice Johnson, Mon, May 4, 2026, day shift, scheduled staff, opens schedule actions')
  })

  it('distinguishes lead cells and read-only cells', () => {
    expect(
      buildScheduleCellAccessibleLabel({
        therapistName: 'Alice Johnson',
        date: '2026-05-04',
        shiftType: 'night',
        cell: {
          shiftId: 's1',
          status: 'lead',
          hasNeedsOff: false,
          isIneligible: false,
        },
        canOpenActions: false,
      })
    ).toBe('Alice Johnson, Mon, May 4, 2026, night shift, lead, read-only')
  })

  it('expands compact operational status codes', () => {
    const cases: Array<[GridCell['status'], string]> = [
      ['on_call', 'on call'],
      ['cancelled', 'cancelled'],
      ['call_in', 'call in'],
      ['left_early', 'left early'],
    ]

    for (const [status, statusLabel] of cases) {
      expect(
        buildScheduleCellAccessibleLabel({
          therapistName: 'Alice Johnson',
          date: '2026-05-04',
          shiftType: 'day',
          cell: {
            shiftId: 's1',
            status,
            hasNeedsOff: false,
            isIneligible: false,
          },
          canOpenActions: true,
        })
      ).toContain(`day shift, ${statusLabel}, opens schedule actions`)
    }
  })

  it('includes Need Off and default ineligible context without changing the visual code', () => {
    expect(
      buildScheduleCellAccessibleLabel({
        therapistName: 'Alice Johnson',
        date: '2026-05-05',
        shiftType: 'day',
        cell: {
          shiftId: null,
          status: 'off',
          hasNeedsOff: true,
          isIneligible: true,
        },
        canOpenActions: false,
      })
    ).toBe(
      'Alice Johnson, Tue, May 5, 2026, day shift, not scheduled, Need Off, not eligible, read-only'
    )
  })

  it('explains why an off cell is not eligible when a reason is available', () => {
    expect(
      buildScheduleCellAccessibleLabel({
        therapistName: 'Alice Johnson',
        date: '2026-05-05',
        shiftType: 'day',
        cell: {
          shiftId: null,
          status: 'off',
          hasNeedsOff: false,
          isIneligible: true,
          ineligibleReason: 'fmla',
        },
        canOpenActions: false,
      })
    ).toBe(
      'Alice Johnson, Tue, May 5, 2026, day shift, not scheduled, not eligible: FMLA, read-only'
    )

    expect(
      buildScheduleCellAccessibleLabel({
        therapistName: 'Alice Johnson',
        date: '2026-05-06',
        shiftType: 'day',
        cell: {
          shiftId: null,
          status: 'off',
          hasNeedsOff: false,
          isIneligible: true,
          ineligibleReason: 'weekly_limit',
        },
        canOpenActions: false,
      })
    ).toContain('not eligible: weekly work limit reached')
  })
})
