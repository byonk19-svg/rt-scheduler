'use client'

import { memo, useMemo } from 'react'

import { AssignmentStatusPopover } from '@/components/coverage/AssignmentStatusPopover'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { DayItem, ShiftItem, ShiftTab, UiStatus } from '@/lib/coverage/selectors'
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
  onOpenEditor?: (dayId: string) => void
  onQuickAssign?: (date: string, memberId: string, role: 'lead' | 'staff') => void
  onChangeStatus?: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
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

type MobileAssignment = {
  member: RosterMemberRow
  shift: ShiftItem
  isLead: boolean
}

function buildAssignmentsForDay(day: DayItem | undefined, rows: RosterMemberRow[]): MobileAssignment[] {
  if (!day) return []

  return rows.flatMap((member) => {
    const cell = getCellForMember(day, member.id)
    return cell ? [{ member, shift: cell.shift, isLead: cell.isLead }] : []
  })
}

function renderMobileAssignmentBadge({
  assignment,
  dayId,
  canUpdateAssignmentStatus,
  onChangeStatus,
}: {
  assignment: MobileAssignment
  dayId: string
  canUpdateAssignmentStatus: boolean
  onChangeStatus?: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
}) {
  const token = statusToken(assignment.shift.status) || '1'
  const badge = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground',
        assignment.isLead && 'border-[var(--warning-border)]/70 text-[var(--warning-text)]'
      )}
    >
      <span className="truncate">{assignment.member.full_name}</span>
      <span className="font-semibold">{token}</span>
    </span>
  )

  if (!canUpdateAssignmentStatus || !onChangeStatus) {
    return badge
  }

  return (
    <AssignmentStatusPopover
      therapistName={assignment.member.full_name}
      currentStatus={assignment.shift.status}
      isLead={assignment.isLead}
      triggerTestId={`mobile-roster-status-${assignment.member.id}-${dayId}`}
      onChangeStatus={(nextStatus) =>
        onChangeStatus(dayId, assignment.shift.id, assignment.isLead, nextStatus)
      }
    >
      {badge}
    </AssignmentStatusPopover>
  )
}

function MobileRosterDayCards({
  effectiveCycleDates,
  dayMap,
  regularRows,
  prnRows,
  canManageCoverage,
  canUpdateAssignmentStatus,
  onOpenEditor,
  onChangeStatus,
}: {
  effectiveCycleDates: string[]
  dayMap: Map<string, DayItem>
  regularRows: RosterMemberRow[]
  prnRows: RosterMemberRow[]
  canManageCoverage: boolean
  canUpdateAssignmentStatus: boolean
  onOpenEditor?: (dayId: string) => void
  onChangeStatus?: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
}) {
  return (
    <div className="space-y-3 xl:hidden">
      {effectiveCycleDates.map((date) => {
        const day = dayMap.get(date)
        const regularAssignments = buildAssignmentsForDay(day, regularRows)
        const prnAssignments = buildAssignmentsForDay(day, prnRows)
        const leadAssignment = regularAssignments.find((assignment) => assignment.isLead)
        const supportingAssignments = regularAssignments.filter((assignment) => !assignment.isLead)
        const activeCount = [...regularAssignments, ...prnAssignments].filter(
          (assignment) => assignment.shift.status === 'active'
        ).length

        return (
          <article
            key={`mobile-roster-${date}`}
            className="rounded-xl border border-border/70 bg-background/95 px-3.5 py-3 shadow-tw-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {formatWeekdayShort(date)} {formatDayNumber(date)}
                </p>
                <p className="text-xs text-muted-foreground">{activeCount} active assignments</p>
              </div>
              {canManageCoverage && day ? (
                <button
                  type="button"
                  onClick={() => onOpenEditor?.(day.id)}
                  className="inline-flex min-h-11 items-center rounded-lg border border-border/70 bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted/30"
                >
                  Open day editor
                </button>
              ) : null}
            </div>

            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Lead
                </p>
                {leadAssignment ? (
                  renderMobileAssignmentBadge({
                    assignment: leadAssignment,
                    dayId: date,
                    canUpdateAssignmentStatus,
                    onChangeStatus,
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No lead assigned.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Core roster
                </p>
                {supportingAssignments.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {supportingAssignments.map((assignment) => (
                      <div key={assignment.shift.id}>
                        {renderMobileAssignmentBadge({
                          assignment,
                          dayId: date,
                          canUpdateAssignmentStatus,
                          onChangeStatus,
                        })}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No core staff assigned.</p>
                )}
              </div>

              {prnAssignments.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    PRN coverage
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {prnAssignments.map((assignment) => (
                      <div key={assignment.shift.id}>
                        {renderMobileAssignmentBadge({
                          assignment,
                          dayId: date,
                          canUpdateAssignmentStatus,
                          onChangeStatus,
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function tallyClass(count: number): string {
  if (count === 0) return 'text-muted-foreground/35'
  if (count < 3) return 'text-[var(--error-text)] font-bold'
  if (count <= 5) return 'text-[var(--success-text)] font-bold'
  return 'text-[var(--warning-text)] font-semibold'
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
  onQuickAssign,
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
  onQuickAssign?: (date: string, memberId: string, role: 'lead' | 'staff') => void
  onChangeStatus?: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
}) {
  const weekGroups = chunkRosterWeeks(weekDates)

  const weekBoundaries = useMemo(() => {
    const set = new Set<string>()
    weekDates.forEach((date, i) => {
      if (i % 7 === 0) set.add(date)
    })
    return set
  }, [weekDates])

  const weekendDates = useMemo(() => {
    return new Set(
      weekDates.filter((date) => {
        const d = new Date(`${date}T00:00:00`)
        return d.getDay() === 0 || d.getDay() === 6
      })
    )
  }, [weekDates])

  const renderCell = (member: RosterMemberRow, date: string) => {
    const day = dayMap.get(date)
    const cell = day ? getCellForMember(day, member.id) : null
    const intent = resolveRosterCellIntent(canManageCoverage, canUpdateAssignmentStatus, cell !== null)
    const token = statusToken(cell?.shift.status)
    const cellHasError = cellError?.dayId === date && cellError?.memberId === member.id

    const isAssigned = cell !== null
    const isActive = cell?.shift.status === 'active'
    const isLead = cell?.isLead === true
    const isOtherStatus = isAssigned && !isActive

    const sharedClass = cn(
      'flex h-7 w-full items-center justify-center rounded-[5px] border text-[10px] font-bold uppercase tracking-[0.08em] transition-all duration-100',
      // Empty cell — invisible at rest
      !isAssigned && 'border-transparent bg-transparent text-transparent',
      // Active scheduled (non-lead)
      isActive && !isLead && 'border-[var(--success-border)]/55 bg-[var(--success-subtle)]/50 text-[var(--success-text)]',
      // Lead cell
      isLead && 'border-[var(--warning-border)]/65 bg-[var(--warning-subtle)]/45 text-[var(--warning-text)]',
      // Operational status (OC/LE/CX/CI, non-lead)
      isOtherStatus && !isLead && 'border-border/55 bg-muted/30 text-foreground',
      // Interactive states
      intent === 'quick_assign' && !cellHasError &&
        'cursor-pointer hover:border-primary/35 hover:bg-primary/[0.06] hover:text-primary/55',
      intent === 'manage' && 'cursor-pointer',
      intent === 'manage' && isActive && !isLead && !cellHasError &&
        'hover:border-[var(--success-border)]/75 hover:bg-[var(--success-subtle)]/70',
      intent === 'manage' && isLead && !cellHasError && 'hover:bg-[var(--warning-subtle)]/60',
      intent === 'manage' && isOtherStatus && !isLead && !cellHasError && 'hover:bg-muted/50',
      // Selected day column
      selectedDayId === date && !isAssigned && 'bg-primary/[0.04]',
      selectedDayId === date && isAssigned && 'ring-1 ring-primary/30',
      // Error
      cellHasError && 'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]',
    )

    if (intent === 'manage' || intent === 'quick_assign') {
      const handleClick = () => {
        if (intent === 'quick_assign' && onQuickAssign) {
          const leadRole = member.role === 'lead' && !day?.leadShift ? 'lead' : 'staff'
          onQuickAssign(date, member.id, leadRole)
        } else {
          onOpenEditor?.(date)
        }
      }
      const trigger = (
        <button
          type="button"
          onClick={handleClick}
          className={sharedClass}
          title={cell ? 'Open day editor' : 'Assign to shift'}
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
      <table className="w-full min-w-[900px] table-fixed border-collapse xl:min-w-0">
        <thead>
          {/* Week group row */}
          <tr className="bg-muted/30">
            <th className="sticky left-0 top-0 z-30 w-36 border-b border-r border-border/70 bg-muted/45 px-3 py-1 text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Staff
            </th>
            {weekGroups.map((week, index) => (
              <th
                key={`week-group-${index}`}
                colSpan={week.length}
                className={cn(
                  'sticky top-0 z-20 border-b border-border/70 bg-muted/30 px-2 py-1 text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground',
                  index > 0 && 'border-l-2 border-l-border/55'
                )}
              >
                Wk {index + 1} · {formatWeekLabel(week[0] ?? '')}
              </th>
            ))}
          </tr>
          {/* Day header row */}
          <tr className="bg-card">
            <th className="sticky left-0 top-[24px] z-30 border-b border-r border-border/70 bg-card px-3 py-1 text-left text-[10px] font-semibold text-muted-foreground">
              Therapist
            </th>
            {weekDates.map((date) => {
              const isWeekBoundary = weekBoundaries.has(date)
              const isWeekend = weekendDates.has(date)
              return (
                <th
                  key={`head-${date}`}
                  className={cn(
                    'sticky top-[24px] z-20 border-b border-border/70 bg-card px-0.5 py-1 text-center',
                    isWeekBoundary && 'border-l-2 border-l-border/55',
                    !isWeekBoundary && 'border-l border-l-border/25',
                    isWeekend && 'bg-muted/[0.06]',
                    selectedDayId === date && 'bg-primary/[0.05]',
                  )}
                >
                  <div className="text-[9px] font-semibold leading-none text-muted-foreground/70">
                    {formatWeekdayShort(date)}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold leading-none tabular-nums text-foreground/80">
                    {formatDayNumber(date)}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((member) => (
            <tr
              key={member.id}
              className={cn(
                'border-b border-border/40 hover:bg-muted/[0.06]',
                member.role === 'lead' && 'bg-[var(--warning-subtle)]/12'
              )}
            >
              <th
                scope="row"
                className={cn(
                  'sticky left-0 z-10 border-r border-border/70 bg-card px-3 py-1 text-left',
                  member.role === 'lead' && 'bg-[var(--warning-subtle)]/25'
                )}
              >
                <div className="flex min-w-0 items-center gap-1">
                  <span
                    className={cn(
                      'truncate text-[11px] font-medium',
                      member.role === 'lead' ? 'text-[var(--warning-text)]' : 'text-foreground'
                    )}
                  >
                    {member.full_name}
                  </span>
                  {member.role === 'lead' && (
                    <span className="shrink-0 rounded-[3px] border border-[var(--warning-border)]/55 bg-[var(--warning-subtle)]/60 px-[3px] py-px text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--warning-text)]">
                      L
                    </span>
                  )}
                  {member.employment_type === 'prn' && (
                    <span className="shrink-0 text-[9px] text-muted-foreground/55">PRN</span>
                  )}
                  {member.employment_type === 'part_time' && (
                    <span className="shrink-0 text-[9px] text-muted-foreground/55">PT</span>
                  )}
                </div>
              </th>
              {weekDates.map((date) => {
                const isWeekBoundary = weekBoundaries.has(date)
                const isWeekend = weekendDates.has(date)
                return (
                  <td
                    key={`${member.id}-${date}`}
                    className={cn(
                      'px-0.5 py-0.5',
                      isWeekBoundary ? 'border-l-2 border-l-border/55' : 'border-l border-l-border/25',
                      isWeekend && 'bg-muted/[0.04]',
                      selectedDayId === date && 'bg-primary/[0.04]',
                    )}
                  >
                    {renderCell(member, date)}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr className="border-t border-border/50 bg-muted/20">
            <th className="sticky left-0 z-10 border-r border-border/70 bg-muted/30 px-3 py-1.5 text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Tally
            </th>
            {weekDates.map((date) => {
              const count = assignedMemberCounts.get(date) ?? 0
              const isWeekBoundary = weekBoundaries.has(date)
              const isWeekend = weekendDates.has(date)
              return (
                <td
                  key={`tally-${date}`}
                  className={cn(
                    'py-1.5 text-center text-[10px] tabular-nums',
                    tallyClass(count),
                    isWeekBoundary ? 'border-l-2 border-l-border/55' : 'border-l border-l-border/25',
                    isWeekend && 'bg-muted/[0.04]',
                  )}
                >
                  {count > 0 ? count : ''}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
})

const RosterSection = memo(function RosterSection({
  label,
  staffCount,
  rows,
  dayMap,
  effectiveCycleDates,
  canManageCoverage,
  canUpdateAssignmentStatus,
  selectedDayId,
  cellError,
  onOpenEditor,
  onQuickAssign,
  onChangeStatus,
}: {
  label: string
  staffCount: number
  rows: RosterMemberRow[]
  dayMap: Map<string, DayItem>
  effectiveCycleDates: string[]
  canManageCoverage: boolean
  canUpdateAssignmentStatus: boolean
  selectedDayId: string | null
  cellError: { dayId: string; memberId: string; message: string } | null
  onOpenEditor?: (dayId: string) => void
  onQuickAssign?: (date: string, memberId: string, role: 'lead' | 'staff') => void
  onChangeStatus?: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
}) {
  const assignedMemberCounts = useMemo(
    () => buildAssignedMemberCounts(effectiveCycleDates, rows, dayMap),
    [dayMap, effectiveCycleDates, rows]
  )

  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-2 px-0.5">
        <span className="text-[11px] font-semibold text-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground/70">· {staffCount} staff</span>
        <span className="ml-auto text-[9px] text-muted-foreground/50">
          <span className="mr-1 inline-block rounded border border-[var(--success-border)]/50 bg-[var(--success-subtle)]/50 px-1 text-[var(--success-text)]">1</span>scheduled
          <span className="mx-1.5 text-muted-foreground/30">·</span>
          <span className="mr-1 inline-block rounded border border-[var(--warning-border)]/50 bg-[var(--warning-subtle)]/40 px-1 text-[var(--warning-text)]">L</span>lead
          <span className="mx-1.5 text-muted-foreground/30">·</span>
          OC/LE/CX/CI status
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
        onQuickAssign={onQuickAssign}
        onChangeStatus={onChangeStatus}
      />
    </section>
  )
})

export const RosterScheduleView = memo(function RosterScheduleView({
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
  onOpenEditor,
  onQuickAssign,
  onChangeStatus,
}: RosterScheduleViewProps) {
  const sections = buildRosterSections(members)
  const effectiveCycleDates =
    cycleDates && cycleDates.length > 0 ? cycleDates : days.map((day) => day.id)
  const dayMap = useMemo(() => buildDayMap(days), [days])
  const shiftLabel = shiftTab === 'Night' ? 'Night' : 'Day'
  const heading = title ?? `Respiratory Therapy ${shiftLabel} Shift`

  return (
    <div className="space-y-4">
      {title || cycleLabel ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/12 px-3 py-2 text-xs">
          <span className="font-semibold text-foreground">{heading}</span>
          {cycleLabel ? <span className="text-muted-foreground">{cycleLabel}</span> : null}
        </div>
      ) : null}

      <MobileRosterDayCards
        effectiveCycleDates={effectiveCycleDates}
        dayMap={dayMap}
        regularRows={sections.regularRows}
        prnRows={sections.prnRows}
        canManageCoverage={canManageCoverage}
        canUpdateAssignmentStatus={canUpdateAssignmentStatus}
        onOpenEditor={onOpenEditor}
        onChangeStatus={onChangeStatus}
      />

      <div className="hidden xl:block">
        <RosterSection
          label="Core roster"
          staffCount={sections.regularRows.length}
          rows={sections.regularRows}
          dayMap={dayMap}
          effectiveCycleDates={effectiveCycleDates}
          canManageCoverage={canManageCoverage}
          canUpdateAssignmentStatus={canUpdateAssignmentStatus}
          selectedDayId={selectedDayId}
          cellError={cellError}
          onOpenEditor={onOpenEditor}
          onQuickAssign={onQuickAssign}
          onChangeStatus={onChangeStatus}
        />
      </div>

      {sections.prnRows.length > 0 ? (
        <div className="hidden xl:block">
          <RosterSection
            label="PRN coverage"
            staffCount={sections.prnRows.length}
            rows={sections.prnRows}
            dayMap={dayMap}
            effectiveCycleDates={effectiveCycleDates}
            canManageCoverage={canManageCoverage}
            canUpdateAssignmentStatus={canUpdateAssignmentStatus}
            selectedDayId={selectedDayId}
            cellError={cellError}
            onOpenEditor={onOpenEditor}
            onQuickAssign={onQuickAssign}
            onChangeStatus={onChangeStatus}
          />
        </div>
      ) : null}
    </div>
  )
})
