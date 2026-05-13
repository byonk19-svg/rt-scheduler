'use client'

import { cn } from '@/lib/utils'

import { getCellDisplay, isWorkingScheduledGridCell } from './schedule-grid-utils'
import type { GridCell, GridDataset, TherapistGridRow } from './schedule-grid-types'

type CellClickHandler = (
  userId: string,
  date: string,
  cell: GridCell,
  anchorEl: HTMLElement
) => void

type ScheduleGridTableProps = {
  dataset: GridDataset
  onCellClick?: CellClickHandler
  interactionsDisabled?: boolean
}

function formatHeaderDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return { day: date, number: '' }
  return {
    day: parsed.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
    number: String(parsed.getDate()),
  }
}

function isWeekend(date: string) {
  const parsed = new Date(`${date}T12:00:00`)
  const day = parsed.getDay()
  return day === 0 || day === 6
}

function totalColorClass(date: string, count: number): string {
  if (isWeekend(date)) return 'text-muted-foreground font-semibold'
  if (count < 3) return 'text-red-600 font-bold'
  if (count <= 5) return 'text-teal-700 font-bold'
  return 'text-amber-600 font-bold'
}

function rowScheduledTotal(row: TherapistGridRow, cycleDates: readonly string[]) {
  return cycleDates.reduce((count, date) => {
    return isWorkingScheduledGridCell(row.cells[date]) ? count + 1 : count
  }, 0)
}

export function ScheduleGridTable({
  dataset,
  onCellClick,
  interactionsDisabled = false,
}: ScheduleGridTableProps) {
  const { cycleDates, therapistRows, dailyTotals, viewerRole, viewerUserId } = dataset
  const isStaffViewer = viewerRole === 'therapist' || viewerRole === 'lead'
  const sortedRows = isStaffViewer
    ? [
        ...therapistRows.filter((row) => row.userId === viewerUserId),
        ...therapistRows.filter((row) => row.userId !== viewerUserId),
      ]
    : therapistRows

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-xs">
        <thead>
          <tr className="border-b border-border bg-card">
            <th className="sticky left-0 z-20 min-w-[180px] bg-card px-3 py-2 text-left font-semibold text-muted-foreground">
              Therapist
            </th>
            {cycleDates.map((date) => {
              const label = formatHeaderDate(date)
              return (
                <th
                  key={date}
                  className={cn(
                    'min-w-8 border-l border-border/70 px-1 py-2 text-center font-medium text-muted-foreground',
                    isWeekend(date) && 'bg-muted/45'
                  )}
                >
                  <span className="block text-[10px] uppercase">{label.day}</span>
                  <span className="block text-[11px] text-foreground">{label.number}</span>
                </th>
              )
            })}
            <th className="sticky right-0 z-20 min-w-12 border-l border-border bg-card px-2 py-2 text-center font-semibold text-muted-foreground">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <TherapistRow
              key={row.userId}
              row={row}
              cycleDates={cycleDates}
              isViewer={isStaffViewer && row.userId === viewerUserId}
              canManageCoverage={dataset.canManageCoverage}
              canUpdateAssignmentStatus={dataset.canUpdateAssignmentStatus}
              isPublished={dataset.isPublished}
              interactionsDisabled={interactionsDisabled}
              onCellClick={onCellClick}
            />
          ))}
          <tr className="border-t-2 border-border bg-muted/45">
            <th className="sticky left-0 z-20 bg-muted px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Daily total
            </th>
            {cycleDates.map((date) => (
              <td key={date} className="border-l border-border/70 px-1 py-2 text-center">
                <span
                  data-testid={`total-${date}`}
                  className={totalColorClass(date, dailyTotals[date] ?? 0)}
                >
                  {dailyTotals[date] ?? 0}
                </span>
              </td>
            ))}
            <td className="sticky right-0 z-20 border-l border-border bg-muted" />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function TherapistRow({
  row,
  cycleDates,
  isViewer,
  canManageCoverage,
  canUpdateAssignmentStatus,
  isPublished,
  interactionsDisabled,
  onCellClick,
}: {
  row: TherapistGridRow
  cycleDates: readonly string[]
  isViewer: boolean
  canManageCoverage: boolean
  canUpdateAssignmentStatus: boolean
  isPublished: boolean
  interactionsDisabled: boolean
  onCellClick?: CellClickHandler
}) {
  const total = rowScheduledTotal(row, cycleDates)

  return (
    <tr
      className={cn(
        'border-b border-border/70',
        isViewer && 'border-b-2 border-teal-600 bg-teal-50/55'
      )}
    >
      <th
        scope="row"
        className={cn(
          'sticky left-0 z-10 bg-card px-3 py-2 text-left font-semibold text-foreground',
          isViewer && 'bg-teal-50'
        )}
      >
        <span className="block truncate">{isViewer ? `You (${row.name})` : row.name}</span>
        {row.isOnFmla ? (
          <span className="text-[10px] font-medium uppercase text-muted-foreground">FMLA</span>
        ) : null}
      </th>
      {cycleDates.map((date) => {
        const cell = row.cells[date] ?? {
          shiftId: null,
          status: 'off' as const,
          hasNeedsOff: false,
          isIneligible: false,
        }
        const display = getCellDisplay(cell)
        const canAssign = canManageCoverage && cell.status === 'off'
        const canEditAssigned =
          cell.status !== 'off' && (canManageCoverage || (canUpdateAssignmentStatus && isPublished))
        const clickable = Boolean(
          onCellClick &&
          !interactionsDisabled &&
          !cell.isIneligible &&
          (canAssign || canEditAssigned)
        )

        return (
          <td
            key={date}
            className={cn(
              'border-l border-border/70 px-1 py-1.5 text-center',
              isWeekend(date) && 'bg-muted/25'
            )}
          >
            <button
              type="button"
              data-testid={`cell-${row.userId}-${date}`}
              className={cn(
                'inline-flex min-h-6 min-w-6 items-center justify-center rounded px-1 text-[11px] font-bold leading-none',
                display.isEmpty ? 'text-muted-foreground' : display.colorClass,
                clickable
                  ? 'cursor-pointer ring-offset-background transition hover:ring-2 hover:ring-ring/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  : 'cursor-default',
                cell.isIneligible && 'opacity-45'
              )}
              disabled={!clickable}
              onClick={(event) => onCellClick?.(row.userId, date, cell, event.currentTarget)}
            >
              {display.code}
              {display.asterisk ? (
                <sup
                  data-testid={`asterisk-${row.userId}-${date}`}
                  className="ml-px text-[9px] font-black text-foreground"
                >
                  *
                </sup>
              ) : null}
            </button>
          </td>
        )
      })}
      <td className="sticky right-0 z-10 border-l border-border bg-card px-2 py-1.5 text-center font-bold text-foreground">
        {total}
      </td>
    </tr>
  )
}
