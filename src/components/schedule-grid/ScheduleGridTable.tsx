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

function isWeekStart(date: string) {
  const parsed = new Date(`${date}T12:00:00`)
  return parsed.getDay() === 0
}

function totalColorClass(date: string, count: number): string {
  if (isWeekend(date)) return 'text-muted-foreground font-semibold'
  if (count < 3) return 'text-red-600 font-bold'
  if (count <= 5) return 'text-teal-700 font-bold'
  return 'text-amber-600 font-bold'
}

function dailyTotalsForRows(rows: readonly TherapistGridRow[], cycleDates: readonly string[]) {
  const totals: Record<string, number> = {}
  for (const date of cycleDates) {
    totals[date] = rows.reduce((count, row) => {
      return isWorkingScheduledGridCell(row.cells[date]) ? count + 1 : count
    }, 0)
  }
  return totals
}

function orderManagerRows(rows: readonly TherapistGridRow[]) {
  const regularRows = rows.filter((row) => row.employmentType !== 'prn')
  const prnRows = rows.filter((row) => row.employmentType === 'prn')
  return { regularRows, prnRows }
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
  const { regularRows, prnRows } = orderManagerRows(sortedRows)
  const showPrnSection = !isStaffViewer && prnRows.length > 0
  const regularDailyTotals = dailyTotalsForRows(regularRows, cycleDates)
  const shiftLabel = dataset.shiftType === 'night' ? 'night-shift' : 'day-shift'

  if (sortedRows.length === 0) {
    return (
      <div className="border-t border-border bg-card px-6 py-10 text-center">
        <p className="text-base font-semibold text-foreground">
          No {shiftLabel} therapists found for this Schedule Block.
        </p>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {dataset.canManageCoverage
            ? 'Switch shifts or check Team roster settings, then return to Schedule.'
            : 'Ask a manager to check the roster or publish the correct shift schedule.'}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full min-w-max border-collapse font-mono text-[11px]">
        <thead>
          <tr className="border-b-2 border-border bg-card">
            <th className="sticky left-0 z-20 min-w-[140px] bg-card px-2 py-1.5 text-left font-semibold text-muted-foreground">
              Therapist
            </th>
            {cycleDates.map((date) => {
              const label = formatHeaderDate(date)
              return (
                <th
                  key={date}
                  className={cn(
                    'min-w-6 border-l border-border/80 px-0 py-1.5 text-center font-medium text-muted-foreground',
                    isWeekStart(date) && 'border-l-2 border-l-foreground/40',
                    isWeekend(date) && 'bg-muted/45'
                  )}
                >
                  <span className="block text-[10px] uppercase">{label.day}</span>
                  <span className="block text-[11px] text-foreground">{label.number}</span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {(showPrnSection ? regularRows : sortedRows).map((row) => (
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
          {showPrnSection ? (
            <>
              <DailyTotalRow
                label="Daily staffing"
                cycleDates={cycleDates}
                totals={regularDailyTotals}
                testIdPrefix="regular-total"
              />
              {prnRows.map((row) => (
                <TherapistRow
                  key={row.userId}
                  row={row}
                  cycleDates={cycleDates}
                  isViewer={false}
                  canManageCoverage={dataset.canManageCoverage}
                  canUpdateAssignmentStatus={dataset.canUpdateAssignmentStatus}
                  isPublished={dataset.isPublished}
                  interactionsDisabled={interactionsDisabled}
                  onCellClick={onCellClick}
                />
              ))}
            </>
          ) : null}
          <DailyTotalRow
            label="Daily total"
            cycleDates={cycleDates}
            totals={dailyTotals}
            testIdPrefix="total"
            emphasis="strong"
          />
        </tbody>
      </table>
    </div>
  )
}

function DailyTotalRow({
  label,
  cycleDates,
  totals,
  testIdPrefix,
  emphasis = 'standard',
}: {
  label: string
  cycleDates: readonly string[]
  totals: Record<string, number>
  testIdPrefix: string
  emphasis?: 'standard' | 'strong'
}) {
  return (
    <tr
      className={cn(
        'border-y-2',
        emphasis === 'strong' ? 'border-foreground/30 bg-muted/75' : 'border-border bg-muted/55'
      )}
    >
      <th
        className={cn(
          'sticky left-0 z-20 bg-muted px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide',
          emphasis === 'strong' ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {label}
      </th>
      {cycleDates.map((date) => (
        <td
          key={date}
          className={cn(
            'border-l border-border/80 px-0 py-1.5 text-center',
            isWeekStart(date) && 'border-l-2 border-l-foreground/40',
            isWeekend(date) && 'bg-muted/45'
          )}
        >
          <span
            data-testid={`${testIdPrefix}-${date}`}
            className={totalColorClass(date, totals[date] ?? 0)}
          >
            {totals[date] ?? 0}
          </span>
        </td>
      ))}
    </tr>
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
  return (
    <tr
      className={cn(
        'border-b border-border/80',
        isViewer && 'border-b-2 border-teal-600 bg-teal-50/55'
      )}
    >
      <th
        scope="row"
        className={cn(
          'sticky left-0 z-10 max-w-[140px] bg-card px-2 py-1.5 text-left font-semibold text-foreground',
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
              'border-l border-border/80 px-0 py-1 text-center',
              isWeekStart(date) && 'border-l-2 border-l-foreground/40',
              isWeekend(date) && 'bg-muted/25'
            )}
          >
            <button
              type="button"
              data-testid={`cell-${row.userId}-${date}`}
              className={cn(
                'inline-flex min-h-5 min-w-5 items-center justify-center rounded px-0.5 text-[11px] font-bold leading-none',
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
    </tr>
  )
}
