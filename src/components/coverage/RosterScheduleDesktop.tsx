'use client'

import { memo, useMemo } from 'react'

import { AssignmentStatusPopover } from '@/components/coverage/AssignmentStatusPopover'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { DayItem, UiStatus } from '@/lib/coverage/selectors'
import { formatDayNumber, formatWeekdayShort } from '@/lib/schedule-helpers'
import { cn } from '@/lib/utils'
import type { RosterMemberRow } from '@/components/coverage/RosterScheduleView'

const STATUS_TOKEN_BY_UI_STATUS: Record<UiStatus, string> = {
  active: '1',
  oncall: 'OC',
  leave_early: 'LE',
  cancelled: 'CX',
  call_in: 'CI',
}

export function chunkRosterWeeks<T>(items: readonly T[], weekSize = 7): T[][] {
  const weeks: T[][] = []
  for (let index = 0; index < items.length; index += weekSize) {
    weeks.push(items.slice(index, index + weekSize))
  }
  return weeks
}

export function resolveRosterCellIntent(
  canManageCoverage: boolean,
  canUpdateAssignmentStatus: boolean,
  hasShift: boolean
): 'quick_assign' | 'manage' | 'status' | 'none' {
  if (canManageCoverage) return hasShift ? 'manage' : 'quick_assign'
  if (canUpdateAssignmentStatus && hasShift) return 'status'
  return 'none'
}

function statusToken(status: UiStatus | undefined): string {
  if (!status) return ''
  return STATUS_TOKEN_BY_UI_STATUS[status]
}

function formatWeekLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getCellForMember(day: DayItem, memberId: string) {
  if (day.leadShift?.userId === memberId) {
    return { shift: day.leadShift, isLead: true as const }
  }

  const staffShift = day.staffShifts.find((shift) => shift.userId === memberId)
  if (staffShift) {
    return { shift: staffShift, isLead: false as const }
  }

  return null
}

function buildAssignedMemberCounts(
  weekDates: string[],
  rows: RosterMemberRow[],
  dayMap: Map<string, DayItem>
): Map<string, number> {
  const counts = new Map<string, number>()

  for (const date of weekDates) {
    const day = dayMap.get(date)
    if (!day) {
      counts.set(date, 0)
      continue
    }

    let total = 0
    for (const row of rows) {
      if (getCellForMember(day, row.id)?.shift.status === 'active') {
        total += 1
      }
    }
    counts.set(date, total)
  }

  return counts
}

const RosterMatrixTable = memo(function RosterMatrixTable({
  weekDates,
  rows,
  dayMap,
  canManageCoverage,
  canUpdateAssignmentStatus,
  selectedDayId,
  cellError,
  assignedMemberCounts,
  onOpenEditor,
  onChangeStatus,
}: {
  weekDates: string[]
  rows: RosterMemberRow[]
  dayMap: Map<string, DayItem>
  canManageCoverage: boolean
  canUpdateAssignmentStatus: boolean
  selectedDayId: string | null
  cellError: { dayId: string; memberId: string; message: string } | null
  assignedMemberCounts: Map<string, number>
  onOpenEditor?: (dayId: string) => void
  onChangeStatus?: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
}) {
  const weekGroups = chunkRosterWeeks(weekDates)

  const renderCell = (member: RosterMemberRow, date: string) => {
    const day = dayMap.get(date)
    const cell = day ? getCellForMember(day, member.id) : null
    const intent = resolveRosterCellIntent(canManageCoverage, canUpdateAssignmentStatus, cell !== null)
    const token = statusToken(cell?.shift.status)
    const cellHasError = cellError?.dayId === date && cellError?.memberId === member.id
    const sharedClass = cn(
      'flex h-7.5 w-full cursor-pointer items-center justify-center rounded-md border text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors',
      token.length > 0
        ? 'border-border/60 bg-background text-foreground'
        : 'border-transparent bg-transparent text-transparent',
      (intent === 'manage' || intent === 'quick_assign') &&
        !cellHasError &&
        'border-primary/25 bg-primary/[0.03] text-foreground hover:bg-primary/[0.08]',
      cell?.isLead && 'border-[var(--warning-border)]/65 bg-[var(--warning-subtle)]/35 text-[var(--warning-text)]',
      selectedDayId === date && 'bg-primary/10 ring-1 ring-primary/25',
      cellHasError && 'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]'
    )

    if (intent === 'manage' || intent === 'quick_assign') {
      const trigger = (
        <button
          type="button"
          onClick={() => {
            onOpenEditor?.(date)
          }}
          className={sharedClass}
          title={cell ? 'Open day editor' : 'Add from day editor'}
        >
          {token || '+'}
        </button>
      )

      if (!cellHasError) {
        return trigger
      }

      return (
        <Popover open>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            side="top"
            align="center"
            className="w-48 rounded-xl border-[var(--error-border)] bg-[var(--error-subtle)] p-2 text-[12px] shadow-sm"
          >
            <p className="font-medium text-[var(--error-text)]">{cellError.message}</p>
            {onOpenEditor ? (
              <button
                type="button"
                className="mt-2 w-full rounded-lg bg-white px-2 py-1.5 text-left text-[12px] font-medium text-foreground hover:bg-muted/40"
                onClick={() => onOpenEditor(date)}
              >
                Open editor
              </button>
            ) : null}
          </PopoverContent>
        </Popover>
      )
    }

    if (intent === 'status' && day && cell && onChangeStatus) {
      return (
        <AssignmentStatusPopover
          therapistName={member.full_name}
          currentStatus={cell.shift.status}
          isLead={cell.isLead}
          triggerTestId={`roster-status-${member.id}-${date}`}
          onChangeStatus={(nextStatus) => onChangeStatus(day.id, cell.shift.id, cell.isLead, nextStatus)}
        >
          <span className={sharedClass}>{token || '1'}</span>
        </AssignmentStatusPopover>
      )
    }

    return <span className={sharedClass}>{token}</span>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/70 bg-background/95 xl:overflow-visible">
      <table className="w-full min-w-[960px] table-fixed border-collapse xl:min-w-0">
        <thead>
          <tr className="bg-muted/35">
            <th className="sticky left-0 top-0 z-30 w-44 border-b border-r border-border/70 bg-muted/50 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Clinical staff
            </th>
            {weekGroups.map((week, index) => (
              <th
                key={`week-group-${index}`}
                colSpan={week.length}
                className="sticky top-0 z-20 border-b border-border/70 bg-muted/35 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                Week {index + 1} - {formatWeekLabel(week[0] ?? '')}
              </th>
            ))}
          </tr>
          <tr className="bg-card">
            <th className="sticky left-0 top-[32px] z-30 border-b border-r border-border/70 bg-card px-4 py-2 text-left text-[11px] font-semibold text-foreground">
              Therapist
            </th>
            {weekDates.map((date) => (
              <th
                key={`head-${date}`}
                className="sticky top-[32px] z-20 border-b border-border/70 bg-card px-1 py-2 text-center text-[10px] font-semibold text-muted-foreground"
              >
                <div className="leading-none">{formatWeekdayShort(date)}</div>
                <div className="mt-1 leading-none text-foreground/80">{formatDayNumber(date)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((member) => (
            <tr
              key={member.id}
              className={cn(
                'border-b border-border/50 hover:bg-muted/8',
                member.role === 'lead' && 'bg-[var(--warning-subtle)]/18'
              )}
            >
              <th
                scope="row"
                className={cn(
                  'sticky left-0 z-10 border-r border-border/70 bg-card px-4 py-1.5 text-left text-[12px] font-medium text-foreground',
                  member.role === 'lead' && 'bg-[var(--warning-subtle)]/30 text-[var(--warning-text)]'
                )}
              >
                {member.full_name}
              </th>
              {weekDates.map((date) => (
                <td
                  key={`${member.id}-${date}`}
                  className={cn(
                    'border-l border-border/35 px-1 py-1 text-center',
                    selectedDayId === date && 'bg-primary/[0.04]'
                  )}
                >
                  {renderCell(member, date)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="bg-muted/25">
            <th className="sticky left-0 z-10 border-r border-border/70 bg-muted/35 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Active tally
            </th>
            {weekDates.map((date) => (
              <td
                key={`tally-${date}`}
                className="border-l border-border/35 px-1 py-2 text-center text-[10px] font-semibold text-foreground/75"
              >
                {assignedMemberCounts.get(date) || ''}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
})

export const RosterSection = memo(function RosterSection({
  label,
  description,
  rows,
  dayMap,
  effectiveCycleDates,
  canManageCoverage,
  canUpdateAssignmentStatus,
  selectedDayId,
  cellError,
  onOpenEditor,
  onChangeStatus,
}: {
  label: string
  description: string
  rows: RosterMemberRow[]
  dayMap: Map<string, DayItem>
  effectiveCycleDates: string[]
  canManageCoverage: boolean
  canUpdateAssignmentStatus: boolean
  selectedDayId: string | null
  cellError: { dayId: string; memberId: string; message: string } | null
  onOpenEditor?: (dayId: string) => void
  onChangeStatus?: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
}) {
  const assignedMemberCounts = useMemo(
    () => buildAssignedMemberCounts(effectiveCycleDates, rows, dayMap),
    [dayMap, effectiveCycleDates, rows]
  )

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {rows.length} staff
        </span>
      </div>

      <RosterMatrixTable
        weekDates={effectiveCycleDates}
        rows={rows}
        dayMap={dayMap}
        canManageCoverage={canManageCoverage}
        canUpdateAssignmentStatus={canUpdateAssignmentStatus}
        selectedDayId={selectedDayId}
        cellError={cellError}
        assignedMemberCounts={assignedMemberCounts}
        onOpenEditor={onOpenEditor}
        onChangeStatus={onChangeStatus}
      />
    </section>
  )
})
