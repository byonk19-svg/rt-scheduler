import type { GridCell, GridCellStatus, TherapistGridRow } from './schedule-grid-types'

export type CellDisplay = {
  code: string
  colorClass: string
  asterisk: boolean
  isEmpty: boolean
}

const STATUS_CODE: Record<GridCellStatus, string> = {
  lead: '1',
  staff: '1',
  on_call: 'OC',
  cancelled: 'CX',
  call_in: 'CI',
  left_early: 'LE',
  off: '·',
}

const STATUS_COLOR: Record<GridCellStatus, string> = {
  lead: 'bg-yellow-200 text-yellow-900',
  staff: 'bg-blue-100 text-blue-700',
  on_call: 'bg-yellow-50 text-yellow-700',
  cancelled: 'bg-red-100 text-red-800',
  call_in: 'bg-green-100 text-green-800',
  left_early: 'bg-orange-100 text-orange-800',
  off: '',
}

export function getCellDisplay(cell: GridCell): CellDisplay {
  return {
    code: STATUS_CODE[cell.status],
    colorClass: STATUS_COLOR[cell.status],
    asterisk: cell.hasNeedsOff,
    isEmpty: cell.status === 'off',
  }
}

export function isWorkingScheduledGridCell(cell: GridCell | null | undefined): boolean {
  return cell?.status === 'staff' || cell?.status === 'lead'
}

export function buildDailyTotals(
  rows: readonly TherapistGridRow[],
  dates: readonly string[]
): Record<string, number> {
  const totals: Record<string, number> = {}

  for (const date of dates) {
    totals[date] = rows.reduce((count, row) => {
      const cell = row.cells[date]
      return isWorkingScheduledGridCell(cell) ? count + 1 : count
    }, 0)
  }

  return totals
}
