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
  off: '.',
}

const STATUS_COLOR: Record<GridCellStatus, string> = {
  lead: 'border border-yellow-300 bg-yellow-200 text-yellow-950',
  staff: 'text-[var(--print-ink)]',
  on_call: 'font-black text-[var(--warning-text)]',
  cancelled: 'font-black text-[var(--error-text)]',
  call_in: 'font-black text-[var(--success-text)]',
  left_early: 'font-black text-orange-700',
  off: '',
}

const STATUS_ACCESSIBLE_LABEL: Record<GridCellStatus, string> = {
  lead: 'lead',
  staff: 'scheduled staff',
  on_call: 'on call',
  cancelled: 'cancelled',
  call_in: 'call in',
  left_early: 'left early',
  off: 'not scheduled',
}

const INELIGIBLE_REASON_LABEL: Record<NonNullable<GridCell['ineligibleReason']>, string> = {
  inactive: 'not eligible: inactive team member',
  fmla: 'not eligible: FMLA',
  weekly_limit: 'not eligible: weekly work limit reached',
}

function formatCellDateLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date

  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getCellDisplay(cell: GridCell): CellDisplay {
  return {
    code: STATUS_CODE[cell.status],
    colorClass: STATUS_COLOR[cell.status],
    asterisk: cell.hasNeedsOff,
    isEmpty: cell.status === 'off',
  }
}

export function buildScheduleCellAccessibleLabel({
  therapistName,
  date,
  shiftType,
  cell,
  canOpenActions,
}: {
  therapistName: string
  date: string
  shiftType: TherapistGridRow['shiftType']
  cell: GridCell
  canOpenActions: boolean
}): string {
  const parts = [
    therapistName,
    formatCellDateLabel(date),
    `${shiftType} shift`,
    STATUS_ACCESSIBLE_LABEL[cell.status],
  ]

  if (cell.hasNeedsOff) {
    parts.push('Need Off')
  }

  if (cell.isIneligible) {
    parts.push(
      cell.ineligibleReason ? INELIGIBLE_REASON_LABEL[cell.ineligibleReason] : 'not eligible'
    )
  }

  parts.push(canOpenActions ? 'opens schedule actions' : 'read-only')

  return parts.join(', ')
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
