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

function weekBoundaryClass(date: string): string {
  return isWeekStart(date) ? 'border-l-2 border-l-foreground/35' : 'border-l border-border/55'
}

function totalToneClass(date: string): string {
  return isWeekend(date)
    ? 'border-border/70 bg-muted/80 text-[var(--print-ink-muted)]'
    : 'border-border/70 bg-[var(--print-paper)] text-[var(--print-ink)]'
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
    <div className="max-h-[min(72vh,46rem)] overflow-auto bg-[var(--print-paper)]">
      <table className="w-full min-w-max border-collapse text-[8px]">
        <thead>
          <tr className="border-b border-border/70 bg-[var(--print-paper)]">
            <th className="sticky left-0 top-0 z-40 min-w-[118px] bg-[var(--print-paper)] px-2 py-1.5 text-left font-black uppercase tracking-[0.04em] text-[var(--print-ink)] shadow-[1px_0_0_var(--border)]">
              Date
            </th>
            {cycleDates.map((date) => {
              const label = formatHeaderDate(date)
              return (
                <th
                  key={date}
                  className={cn(
                    'sticky top-0 z-30 min-w-5 px-0.5 py-1 text-center font-black text-[var(--print-ink-muted)] shadow-[0_1px_0_var(--border)]',
                    weekBoundaryClass(date),
                    isWeekend(date)
                      ? 'bg-[color-mix(in_srgb,var(--print-paper)_84%,var(--muted))]'
                      : 'bg-[var(--print-paper)]'
                  )}
                >
                  <span className="block text-[7px] uppercase leading-tight">{label.day}</span>
                  <span className="block text-[8px] leading-tight text-[var(--print-ink)]">
                    {label.number}
                  </span>
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
            sticky
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
  sticky = false,
}: {
  label: string
  cycleDates: readonly string[]
  totals: Record<string, number>
  testIdPrefix: string
  sticky?: boolean
}) {
  return (
    <tr className="border-t-2 border-foreground/20 bg-[color-mix(in_srgb,var(--print-paper)_82%,var(--muted))]">
      <th
        className={cn(
          'left-0 z-30 bg-[color-mix(in_srgb,var(--print-paper)_78%,var(--muted))] px-2 py-1.5 text-left text-[8px] font-black uppercase tracking-[0.08em] text-[var(--print-ink)] shadow-[1px_0_0_var(--border)]',
          sticky ? 'sticky bottom-0' : 'sticky'
        )}
      >
        {label}
      </th>
      {cycleDates.map((date) => (
        <td
          key={date}
          className={cn(
            weekBoundaryClass(date),
            'bg-[color-mix(in_srgb,var(--print-paper)_78%,var(--muted))] px-0 py-1 text-center',
            sticky && 'sticky bottom-0 z-20 shadow-[0_-1px_0_var(--border)]'
          )}
        >
          <span
            data-testid={`${testIdPrefix}-${date}`}
            className={cn(
              'inline-flex min-h-4 min-w-4 items-center justify-center rounded-[2px] border px-0 text-[8px] font-black tabular-nums',
              totalToneClass(date)
            )}
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
        'border-b border-border/45',
        isViewer && 'border-b-2 border-teal-700 bg-teal-50/60'
      )}
    >
      <th
        scope="row"
        className={cn(
          'sticky left-0 z-10 bg-[var(--print-paper)] px-2 py-1 text-left text-[9px] font-black text-[var(--print-ink)] shadow-[1px_0_0_var(--border)]',
          isViewer && 'bg-teal-50 shadow-[inset_3px_0_0_rgb(15_118_110),1px_0_0_var(--border)]'
        )}
      >
        <span className="block truncate">{isViewer ? `You (${row.name})` : row.name}</span>
        {isViewer ? (
          <span className="mt-0.5 inline-flex rounded-[2px] border border-teal-700/35 bg-teal-100 px-1 text-[6px] font-black uppercase leading-3 tracking-[0.08em] text-teal-900">
            Your row
          </span>
        ) : null}
        {row.isOnFmla ? (
          <span className="text-[7px] font-black uppercase text-muted-foreground">FMLA</span>
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
              'px-0 py-0.5 text-center',
              weekBoundaryClass(date),
              isWeekend(date) && 'bg-[color-mix(in_srgb,var(--print-paper)_90%,var(--muted))]',
              isViewer && 'bg-teal-50/45'
            )}
          >
            <button
              type="button"
              data-testid={`cell-${row.userId}-${date}`}
              className={cn(
                'inline-flex min-h-4 min-w-4 items-center justify-center rounded-[2px] px-0 text-[8px] font-black leading-none tabular-nums',
                isViewer && !display.isEmpty && 'ring-1 ring-teal-700/30',
                display.isEmpty
                  ? 'text-[var(--print-ink-muted)] hover:bg-muted/35'
                  : display.colorClass,
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
                  className="ml-px text-[6px] font-black text-[var(--print-ink)]"
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
