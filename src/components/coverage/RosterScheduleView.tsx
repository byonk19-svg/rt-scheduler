'use client'

import {
  AssignmentStatusPopover,
  StatusPill,
} from '@/components/coverage/AssignmentStatusPopover'
import type { DayItem, ShiftTab, UiStatus } from '@/lib/coverage/selectors'
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
  onSelectDay?: (dayId: string) => void
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
): 'assignment' | 'status' | 'none' {
  if (canManageCoverage) return 'assignment'
  if (canUpdateAssignmentStatus && hasShift) return 'status'
  return 'none'
}

function statusToken(status: UiStatus | undefined): string {
  if (!status) return ''
  return STATUS_TOKEN_BY_UI_STATUS[status]
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

function RosterWeekTable({
  label,
  days,
  sections,
  canManageCoverage,
  canUpdateAssignmentStatus,
  selectedDayId,
  onSelectDay,
  onChangeStatus,
}: {
  label: string
  days: DayItem[]
  sections: ReturnType<typeof buildRosterSections>
  canManageCoverage: boolean
  canUpdateAssignmentStatus: boolean
  selectedDayId: string | null
  onSelectDay?: (dayId: string) => void
  onChangeStatus?: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
}) {
  const renderCell = (member: RosterMemberRow, day: DayItem) => {
    const cell = getCellForMember(day, member.id)
    const intent = resolveRosterCellIntent(canManageCoverage, canUpdateAssignmentStatus, cell !== null)
    const token = statusToken(cell?.shift.status)

    if (intent === 'assignment') {
      return (
        <button
          type="button"
          onClick={() => onSelectDay?.(day.id)}
          className={cn(
            'w-full rounded-md px-1 py-1 text-center transition-colors hover:bg-muted/40',
            selectedDayId === day.id && 'bg-primary/10 ring-1 ring-primary/30'
          )}
        >
          {token}
        </button>
      )
    }

    if (intent === 'status' && cell && onChangeStatus) {
      return (
        <AssignmentStatusPopover
          therapistName={member.full_name}
          currentStatus={cell.shift.status}
          isLead={cell.isLead}
          triggerTestId={`roster-status-${member.id}-${day.id}`}
          onChangeStatus={(nextStatus) => onChangeStatus(day.id, cell.shift.id, cell.isLead, nextStatus)}
        >
          <span className="inline-flex items-center justify-center gap-1">
            <span>{token || '1'}</span>
            {cell.shift.status !== 'active' ? <StatusPill status={cell.shift.status} /> : null}
          </span>
        </AssignmentStatusPopover>
      )
    }

    return token
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/20">
          <tr>
            <th className="w-52 border-b border-border/70 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </th>
            {days.map((day) => (
              <th
                key={`weekday-${day.isoDate}`}
                className="border-b border-border/70 px-2 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                {formatWeekdayShort(day.isoDate)}
              </th>
            ))}
          </tr>
          <tr>
            <th className="border-b border-border/70 px-4 py-2 text-left text-xs font-medium text-muted-foreground">
              Team member
            </th>
            {days.map((day) => (
              <th
                key={`daynum-${day.isoDate}`}
                className="border-b border-border/70 px-2 py-2 text-center text-xs font-medium text-foreground/80"
              >
                {formatDayNumber(day.isoDate)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.regularRows.map((member) => (
            <tr
              key={member.id}
              data-roster-role={member.role === 'lead' ? 'lead' : 'staff'}
              className={cn('border-b border-border/60', member.role === 'lead' && 'bg-primary/5')}
            >
              <th
                scope="row"
                className={cn(
                  'px-4 py-3 text-left text-sm font-medium text-foreground',
                  member.role === 'lead' && 'font-semibold text-primary'
                )}
              >
                <div className="flex items-center gap-2">
                  <span>{member.full_name}</span>
                  {member.role === 'lead' ? (
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                      Lead
                    </span>
                  ) : null}
                </div>
              </th>
              {days.map((day) => (
                <td key={`${member.id}-${day.isoDate}`} className="px-2 py-3 text-center text-xs font-semibold text-foreground/85">
                  {renderCell(member, day)}
                </td>
              ))}
            </tr>
          ))}
          {sections.prnRows.length > 0 ? (
            <tr className="border-b border-border/60 bg-muted/15">
              <th
                scope="row"
                className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                PRN
              </th>
              {days.map((day) => (
                <td key={`prn-divider-${day.isoDate}`} className="px-2 py-2" />
              ))}
            </tr>
          ) : null}
          {sections.prnRows.map((member) => (
            <tr key={member.id} data-roster-role={member.role === 'lead' ? 'lead' : 'staff'}>
              <th
                scope="row"
                className={cn(
                  'px-4 py-3 text-left text-sm font-medium text-foreground',
                  member.role === 'lead' && 'font-semibold text-primary'
                )}
              >
                <div className="flex items-center gap-2">
                  <span>{member.full_name}</span>
                  {member.role === 'lead' ? (
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                      Lead
                    </span>
                  ) : null}
                </div>
              </th>
              {days.map((day) => (
                <td key={`${member.id}-${day.isoDate}`} className="px-2 py-3 text-center text-xs font-semibold text-foreground/85">
                  {renderCell(member, day)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function RosterScheduleView({
  days,
  members,
  shiftTab,
  title,
  cycleLabel,
  canManageCoverage = false,
  canUpdateAssignmentStatus = false,
  selectedDayId = null,
  onSelectDay,
  onChangeStatus,
}: RosterScheduleViewProps) {
  const sections = buildRosterSections(members)
  const weekGroups = chunkRosterWeeks(days)
  const shiftLabel = shiftTab === 'Night' ? 'Night' : 'Day'
  const heading = title ?? `Respiratory Therapy ${shiftLabel} Shift`

  if (members.length === 0 || days.length === 0) {
    return (
      <section className="rounded-[1.5rem] border border-dashed border-border/70 bg-muted/8 px-6 py-8 text-center">
        <h2 className="text-base font-semibold text-foreground">{heading}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No staffed therapists are assigned for this roster yet.
        </p>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <header className="rounded-[1.5rem] border border-border/70 bg-card px-5 py-4 shadow-sm">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Roster view
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foreground">
          {heading}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {cycleLabel ? `${cycleLabel} · ` : ''}
          Lead therapists stay pinned first. Regular staff appear above PRN coverage.
        </p>
      </header>

      {weekGroups.map((weekDays, index) => (
        <RosterWeekTable
          key={`roster-week-${index + 1}-${weekDays[0]?.id ?? 'empty'}`}
          label={index === 0 ? 'Roster' : `Week ${index + 1}`}
          days={weekDays}
          sections={sections}
          canManageCoverage={canManageCoverage}
          canUpdateAssignmentStatus={canUpdateAssignmentStatus}
          selectedDayId={selectedDayId}
          onSelectDay={onSelectDay}
          onChangeStatus={onChangeStatus}
        />
      ))}
    </div>
  )
}
