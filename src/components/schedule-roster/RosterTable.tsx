'use client'

import { useMemo, useRef } from 'react'

import { AssignShiftPopover } from '@/components/schedule-roster/AssignShiftPopover'
import {
  createAssignmentKey,
  getAssignment,
  getAvailabilityApproval,
  resolveMockRosterCellDisplay,
  type AssignmentStore,
  type AvailabilityApprovalStore,
  type RosterWeek,
  type ShiftType,
  type Staff,
} from '@/lib/mock-coverage-roster'
import { cn } from '@/lib/utils'

type SelectedCell = {
  staffId: string
  isoDate: string
}

type RosterTableProps = {
  title: string
  subtitle: string
  badge: string
  staff: readonly Staff[]
  weeks: readonly RosterWeek[]
  assignments: AssignmentStore
  availabilityApprovals: AvailabilityApprovalStore
  selectedShift: ShiftType
  selectedCell: SelectedCell | null
  onSelectedCellChange: (cell: SelectedCell | null) => void
  onAssign: (cell: SelectedCell) => void
  onUnassign: (cell: SelectedCell) => void
  /** Live data: cells are display-only (assignments and availability come from the server). */
  readOnly?: boolean
}

function getCellLabel(
  staffName: string,
  isoDate: string,
  selectedShift: ShiftType,
  symbol: ReturnType<typeof resolveMockRosterCellDisplay>['symbol']
): string {
  const ctx = `${staffName} on ${isoDate} for the ${selectedShift} shift`
  if (symbol === 'x') return `Approved day off for ${ctx}`
  if (symbol === '1') return `Manage roster cell for ${ctx}`
  return `Assign ${ctx}`
}

export function RosterTable({
  title,
  subtitle,
  badge,
  staff,
  weeks,
  assignments,
  availabilityApprovals,
  selectedShift,
  selectedCell,
  onSelectedCellChange,
  onAssign,
  onUnassign,
  readOnly = false,
}: RosterTableProps) {
  const flatDays = useMemo(() => weeks.flatMap((week) => week.days), [weeks])
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const handleCellKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    const lastRow = staff.length - 1
    const lastColumn = flatDays.length - 1
    let nextRow = rowIndex
    let nextColumn = colIndex

    switch (event.key) {
      case 'ArrowRight':
        nextColumn = Math.min(colIndex + 1, lastColumn)
        break
      case 'ArrowLeft':
        nextColumn = Math.max(colIndex - 1, 0)
        break
      case 'ArrowDown':
        nextRow = Math.min(rowIndex + 1, lastRow)
        break
      case 'ArrowUp':
        nextRow = Math.max(rowIndex - 1, 0)
        break
      case 'Home':
        nextColumn = 0
        break
      case 'End':
        nextColumn = lastColumn
        break
      default:
        return
    }

    event.preventDefault()
    const nextDay = flatDays[nextColumn]
    const nextStaff = staff[nextRow]
    if (!nextDay || !nextStaff) return
    const nextKey = createAssignmentKey(nextStaff.id, nextDay.isoDate, selectedShift)
    buttonRefs.current.get(nextKey)?.focus()
  }

  const countFilledForDay = (isoDate: string): number =>
    staff.reduce((total, member) => {
      const assignment = getAssignment(assignments, member.id, isoDate, selectedShift)
      const approval = getAvailabilityApproval(
        availabilityApprovals,
        member.id,
        isoDate,
        selectedShift
      )
      const { countsTowardDayTally } = resolveMockRosterCellDisplay(assignment, approval)
      return total + (countsTowardDayTally ? 1 : 0)
    }, 0)

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-[-0.03em] text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <span className="rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
          {badge}
        </span>
      </div>

      <div className="max-h-[34rem] overflow-auto rounded-3xl border border-border/80 bg-background/95 shadow-sm">
        <table
          role="grid"
          aria-label={title}
          className="min-w-full border-separate border-spacing-0"
        >
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-50 min-w-[142px] border-b border-r border-border/80 bg-card px-2.5 py-2 text-left xl:min-w-[152px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Clinical staff
                </p>
              </th>
              {weeks.map((week) => (
                <th
                  key={week.id}
                  colSpan={week.days.length}
                  className="sticky top-0 z-40 border-b border-border/80 bg-card px-1 py-2 text-left text-[8px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap text-muted-foreground xl:text-[9px]"
                >
                  {week.label}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 top-[38px] z-50 border-b border-r border-border/80 bg-card px-2.5 py-2 text-left text-sm font-semibold text-foreground">
                Therapist
              </th>
              {flatDays.map((day) => (
                <th
                  key={`${title}-${day.isoDate}`}
                  className="sticky top-[38px] z-40 min-w-[22px] border-b border-border/80 bg-card px-0 py-2 text-center xl:min-w-[24px]"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {day.dayLabel}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold text-foreground xl:text-[11px]">
                    {day.dayNumber}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((member, rowIndex) => (
              <tr key={member.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-30 border-b border-r border-border/80 bg-background px-2.5 py-1.5 text-left text-[13px] font-medium whitespace-nowrap text-foreground xl:text-sm"
                >
                  {member.name}
                </th>
                {flatDays.map((day, colIndex) => {
                  const assignment = getAssignment(
                    assignments,
                    member.id,
                    day.isoDate,
                    selectedShift
                  )
                  const approval = getAvailabilityApproval(
                    availabilityApprovals,
                    member.id,
                    day.isoDate,
                    selectedShift
                  )
                  const { symbol } = resolveMockRosterCellDisplay(assignment, approval)
                  const cell = { staffId: member.id, isoDate: day.isoDate }
                  const isOpen =
                    selectedCell?.staffId === member.id && selectedCell?.isoDate === day.isoDate
                  const buttonKey = createAssignmentKey(member.id, day.isoDate, selectedShift)

                  const cellButtonClass = cn(
                    'flex h-5.5 w-full items-center justify-center rounded-full border text-[9px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 xl:h-6',
                    symbol === '1' &&
                      'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]',
                    symbol === 'x' &&
                      'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]',
                    symbol === '+' &&
                      'border-dashed border-border/70 bg-card text-muted-foreground hover:border-primary/55 hover:text-primary',
                    readOnly && 'pointer-events-none opacity-95'
                  )

                  return (
                    <td
                      key={buttonKey}
                      className={cn(
                        'border-b border-border/60 px-px py-1 text-center',
                        colIndex % 7 === 0 && 'border-l border-border/80'
                      )}
                    >
                      {readOnly ? (
                        <span
                          role="img"
                          aria-label={getCellLabel(member.name, day.isoDate, selectedShift, symbol)}
                          className={cellButtonClass}
                        >
                          {symbol}
                        </span>
                      ) : (
                        <AssignShiftPopover
                          open={isOpen}
                          onOpenChange={(open) => onSelectedCellChange(open ? cell : null)}
                          staffName={member.name}
                          isoDate={day.isoDate}
                          shiftType={selectedShift}
                          assignment={assignment}
                          availabilityApproval={approval}
                          onConfirm={() => onAssign(cell)}
                          onUnassign={() => onUnassign(cell)}
                          trigger={
                            <button
                              ref={(node) => {
                                if (node) {
                                  buttonRefs.current.set(buttonKey, node)
                                } else {
                                  buttonRefs.current.delete(buttonKey)
                                }
                              }}
                              type="button"
                              aria-label={getCellLabel(
                                member.name,
                                day.isoDate,
                                selectedShift,
                                symbol
                              )}
                              onKeyDown={(event) => handleCellKeyDown(event, rowIndex, colIndex)}
                              className={cellButtonClass}
                            >
                              {symbol}
                            </button>
                          }
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <th className="sticky bottom-0 left-0 z-30 border-r border-border/80 bg-muted/45 px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Active tally
              </th>
              {flatDays.map((day, index) => (
                <td
                  key={`tally-${title}-${day.isoDate}`}
                  className={cn(
                    'sticky bottom-0 z-20 bg-muted/45 px-0 py-2 text-center text-[9px] font-semibold text-foreground',
                    index % 7 === 0 && 'border-l border-border/80'
                  )}
                >
                  {countFilledForDay(day.isoDate) || ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
