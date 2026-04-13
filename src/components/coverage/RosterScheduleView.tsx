'use client'

import { AssignmentStatusPopover } from '@/components/coverage/AssignmentStatusPopover'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { countActive, type DayItem, type ShiftTab, type UiStatus } from '@/lib/coverage/selectors'
import { formatDayNumber, formatWeekdayShort } from '@/lib/schedule-helpers'
import { cn } from '@/lib/utils'

export type RosterMemberRow = {
  id: string
  full_name: string
  role?: 'therapist' | 'lead'
  employment_type?: 'full_time' | 'part_time' | 'prn'
}

type RosterScheduleViewProps = {
  days: DayItem[]
  members: RosterMemberRow[]
  shiftTab?: ShiftTab
  title?: string
  cycleLabel?: string | null
  cycleDates?: string[]
  canManageCoverage?: boolean
  canUpdateAssignmentStatus?: boolean
  selectedDayId?: string | null
  cellError?: { dayId: string; memberId: string; message: string } | null
  onAssignCell?: (dayId: string, memberId: string, role: 'lead' | 'staff') => void
  onOpenEditor?: (dayId: string) => void
  onChangeStatus?: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
  onUnassign?: (dayId: string, shiftId: string, isLead: boolean) => void
}

const STATUS_TOKEN_BY_UI_STATUS: Record<UiStatus, string> = {
  active: '1',
  oncall: 'OC',
  leave_early: 'LE',
  cancelled: 'CX',
  call_in: 'CI',
}

function compareRosterRows(a: RosterMemberRow, b: RosterMemberRow): number {
  const aLead = a.role === 'lead' ? 1 : 0
  const bLead = b.role === 'lead' ? 1 : 0
  if (aLead !== bLead) return bLead - aLead
  return a.full_name.localeCompare(b.full_name)
}

export function buildRosterSections(rows: RosterMemberRow[]): {
  regularRows: RosterMemberRow[]
  prnRows: RosterMemberRow[]
} {
  const regularRows = rows.filter((row) => row.employment_type !== 'prn').sort(compareRosterRows)
  const prnRows = rows.filter((row) => row.employment_type === 'prn').sort(compareRosterRows)
  return { regularRows, prnRows }
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

function buildDayMap(days: DayItem[]): Map<string, DayItem> {
  return new Map(days.map((day) => [day.id, day]))
}

function countAssignedMembers(date: string, rows: RosterMemberRow[], dayMap: Map<string, DayItem>): number {
  const day = dayMap.get(date)
  if (!day) return 0
  let total = 0
  for (const row of rows) {
    if (getCellForMember(day, row.id)?.shift.status === 'active') {
      total += 1
    }
  }
  return total
}

function SummaryCard({
  label,
  value,
  accentClass,
}: {
  label: string
  value: string
  accentClass?: string
}) {
  return (
    <div
      className={cn(
        'min-w-[180px] rounded-2xl border border-border/70 bg-card px-4 py-4 shadow-sm',
        accentClass
      )}
    >
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[1.7rem] font-bold tracking-[-0.04em] text-foreground">{value}</p>
    </div>
  )
}

function RosterMatrixTable({
  weekDates,
  rows,
  dayMap,
  canManageCoverage,
  canUpdateAssignmentStatus,
  selectedDayId,
  cellError,
  onAssignCell,
  onOpenEditor,
  onChangeStatus,
  onUnassign,
}: {
  weekDates: string[]
  rows: RosterMemberRow[]
  dayMap: Map<string, DayItem>
  canManageCoverage: boolean
  canUpdateAssignmentStatus: boolean
  selectedDayId: string | null
  cellError: { dayId: string; memberId: string; message: string } | null
  onAssignCell?: (dayId: string, memberId: string, role: 'lead' | 'staff') => void
  onOpenEditor?: (dayId: string) => void
  onChangeStatus?: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
  onUnassign?: (dayId: string, shiftId: string, isLead: boolean) => void
}) {
  const renderCell = (member: RosterMemberRow, date: string) => {
    const day = dayMap.get(date)
    const cell = day ? getCellForMember(day, member.id) : null
    const intent = resolveRosterCellIntent(canManageCoverage, canUpdateAssignmentStatus, cell !== null)
    const token = statusToken(cell?.shift.status)
    const defaultAssignRole: 'lead' | 'staff' =
      member.role === 'lead' && day && !day.leadShift ? 'lead' : 'staff'
    const cellHasError = cellError?.dayId === date && cellError?.memberId === member.id
    const sharedClass = cn(
      'flex h-8 w-full items-center justify-center rounded-md text-[11px] font-semibold tracking-[0.04em] transition-colors',
      token.length > 0 ? 'text-primary' : 'text-transparent',
      cell?.isLead && 'text-[var(--warning-text)]',
      selectedDayId === date && 'bg-primary/10 ring-1 ring-primary/25',
      cellHasError && 'bg-[var(--error-subtle)] text-[var(--error-text)] ring-1 ring-[var(--error-border)]'
    )

    if (intent === 'quick_assign') {
      const trigger = (
        <button
          type="button"
          onClick={() => onAssignCell?.(date, member.id, defaultAssignRole)}
          className={cn(sharedClass, 'hover:bg-muted/55')}
        >
          {token || '1'}
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

    if (intent === 'manage' && day && cell) {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={cn(sharedClass, 'hover:bg-muted/55')}>
              {token || '1'}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="w-44 rounded-xl border-border/70 p-1.5 shadow-sm">
            <button
              type="button"
              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/50"
              onClick={() => onUnassign?.(day.id, cell.shift.id, cell.isLead)}
            >
              Remove
            </button>
            <button
              type="button"
              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/50"
              onClick={() => onOpenEditor?.(day.id)}
            >
              Open editor
            </button>
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] table-fixed border-collapse">
        <thead>
          <tr className="bg-[var(--info-subtle)]/55">
            <th className="sticky left-0 z-20 w-56 border-b border-r border-border/70 bg-[var(--info-subtle)]/85 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--info-text)]">
              Clinical staff
            </th>
            <th
              colSpan={weekDates.length}
              className="border-b border-border/70 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Week of {formatWeekLabel(weekDates[0] ?? '')}
            </th>
          </tr>
          <tr className="bg-slate-50/90">
            <th className="sticky left-0 z-20 border-b border-r border-border/70 bg-slate-50 px-4 py-2 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Therapist name
            </th>
            {weekDates.map((date) => (
              <th
                key={`head-${date}`}
                className="border-b border-border/70 px-1 py-2 text-center text-[10px] font-bold text-muted-foreground"
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
                'border-b border-border/50 hover:bg-muted/15',
                member.role === 'lead' && 'bg-primary/[0.045]'
              )}
            >
              <th
                scope="row"
                className={cn(
                  'sticky left-0 z-10 border-r border-border/70 bg-white px-4 py-2 text-left text-[13px] font-medium text-foreground',
                  member.role === 'lead' && 'bg-primary/[0.06] font-semibold text-primary'
                )}
              >
                {member.full_name}
              </th>
              {weekDates.map((date) => (
                <td key={`${member.id}-${date}`} className="border-l border-border/35 px-1 py-1 text-center">
                  {renderCell(member, date)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="bg-[var(--info-subtle)]/45">
            <th className="sticky left-0 z-10 border-r border-border/70 bg-[var(--info-subtle)]/75 px-4 py-2 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--info-text)]">
              Daily tally
            </th>
            {weekDates.map((date) => (
              <td
                key={`tally-${date}`}
                className="border-l border-border/35 px-1 py-2 text-center text-[11px] font-bold text-foreground/80"
              >
                {countAssignedMembers(date, rows, dayMap) || ''}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function RosterScheduleView({
  days,
  members,
  shiftTab,
  title,
  cycleLabel,
  cycleDates,
  canManageCoverage = false,
  canUpdateAssignmentStatus = false,
  selectedDayId = null,
  cellError = null,
  onAssignCell,
  onOpenEditor,
  onChangeStatus,
  onUnassign,
}: RosterScheduleViewProps) {
  const sections = buildRosterSections(members)
  const effectiveCycleDates = cycleDates && cycleDates.length > 0 ? cycleDates : days.map((day) => day.id)
  const dayMap = buildDayMap(days)
  const shiftLabel = shiftTab === 'Night' ? 'Night' : 'Day'
  const heading = title ?? `Respiratory Therapy ${shiftLabel} Shift`
  const priorityGapCount = days.filter((day) => !day.leadShift || countActive(day) < 3).length

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_200px_200px]">
        <section className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-sm">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Schedule
          </p>
          <h2 className="mt-1 text-[2rem] font-bold leading-tight tracking-[-0.05em] text-foreground">
            {heading}
          </h2>
          {cycleLabel ? <p className="mt-1 text-sm text-muted-foreground">{cycleLabel}</p> : null}
        </section>

        <SummaryCard label="Total staff active" value={String(members.length)} />
        <SummaryCard
          label="Priority gaps"
          value={`${priorityGapCount}`}
          accentClass="border-[var(--error-border)]/60 shadow-[inset_3px_0_0_0_var(--error)]"
        />
      </div>

      <section className="space-y-5 rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
        <RosterMatrixTable
          weekDates={effectiveCycleDates}
          rows={sections.regularRows}
          dayMap={dayMap}
          canManageCoverage={canManageCoverage}
          canUpdateAssignmentStatus={canUpdateAssignmentStatus}
          selectedDayId={selectedDayId}
          cellError={cellError}
          onAssignCell={onAssignCell}
          onOpenEditor={onOpenEditor}
          onChangeStatus={onChangeStatus}
          onUnassign={onUnassign}
        />

        {sections.prnRows.length > 0 ? (
          <RosterMatrixTable
            weekDates={effectiveCycleDates}
            rows={sections.prnRows}
            dayMap={dayMap}
            canManageCoverage={canManageCoverage}
            canUpdateAssignmentStatus={canUpdateAssignmentStatus}
            selectedDayId={selectedDayId}
            cellError={cellError}
            onAssignCell={onAssignCell}
            onOpenEditor={onOpenEditor}
            onChangeStatus={onChangeStatus}
            onUnassign={onUnassign}
          />
        ) : null}
      </section>
    </div>
  )
}
