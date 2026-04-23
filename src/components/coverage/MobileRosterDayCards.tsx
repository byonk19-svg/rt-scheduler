'use client'

import { AssignmentStatusPopover } from '@/components/coverage/AssignmentStatusPopover'
import type { DayItem, ShiftItem, UiStatus } from '@/lib/coverage/selectors'
import { formatDayNumber, formatWeekdayShort } from '@/lib/schedule-helpers'
import { cn } from '@/lib/utils'
import type { RosterMemberRow } from '@/components/coverage/RosterScheduleView'

type MobileAssignment = {
  member: RosterMemberRow
  shift: ShiftItem
  isLead: boolean
}

const STATUS_TOKEN_BY_UI_STATUS: Record<UiStatus, string> = {
  active: '1',
  oncall: 'OC',
  leave_early: 'LE',
  cancelled: 'CX',
  call_in: 'CI',
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

export function MobileRosterDayCards({
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
