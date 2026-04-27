'use client'

import { useMemo } from 'react'

import {
  getAssignment,
  getAvailabilityApproval,
  resolveMockRosterCellDisplay,
  type AssignmentStore,
  type AvailabilityApprovalStore,
  type RosterCellValue,
  type RosterWeek,
  type ShiftType,
  type Staff,
} from '@/lib/mock-coverage-roster'
import { cn } from '@/lib/utils'

type RosterTableProps = {
  groupLabel: string
  staff: readonly Staff[]
  weeks: readonly RosterWeek[]
  assignments: AssignmentStore
  availabilityApprovals: AvailabilityApprovalStore
  selectedShift: ShiftType
}

function cellClass(value: RosterCellValue, isWeekend: boolean): string {
  const base = cn(
    'flex h-full w-full items-center justify-center text-[10px] font-semibold leading-none',
    isWeekend && value === '' && 'opacity-0'
  )
  switch (value) {
    case '1':
      return cn(base, 'text-foreground')
    case 'OFF':
      return cn(base, 'text-muted-foreground')
    case 'OC':
      return cn(base, 'rounded bg-[var(--primary)] text-white')
    case 'CX':
      return cn(base, 'rounded bg-[var(--error-subtle)] text-[var(--error-text)]')
    case 'LE':
      return cn(base, 'rounded bg-[var(--warning-subtle)] text-[var(--warning-text)]')
    case 'CI':
      return cn(base, 'rounded bg-[var(--info-subtle)] text-[var(--info-text)]')
    default:
      return base
  }
}

export function RosterTable({
  groupLabel,
  staff,
  weeks,
  assignments,
  availabilityApprovals,
  selectedShift,
}: RosterTableProps) {
  const flatDays = useMemo(() => weeks.flatMap((w) => w.days), [weeks])

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

  const weekBoundaryDates = useMemo(() => new Set(weeks.map((w) => w.startDate)), [weeks])

  return (
    <div>
      {/* Group header */}
      <div className="bg-muted/50 px-3 py-1.5 border-b border-border/80">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {groupLabel}
        </span>
      </div>

      {/* Matrix rows */}
      {staff.map((member) => (
        <div key={member.id} className="flex border-b border-border/60 hover:bg-muted/20">
          {/* Sticky name cell */}
          <div className="sticky left-0 z-10 min-w-[130px] w-[130px] shrink-0 border-r border-border/80 bg-background px-2.5 flex items-center">
            <span className="text-[12px] font-medium text-foreground truncate leading-tight py-1.5">
              {member.name}
            </span>
          </div>

          {/* Day cells */}
          {flatDays.map((day) => {
            const assignment = getAssignment(assignments, member.id, day.isoDate, selectedShift)
            const approval = getAvailabilityApproval(
              availabilityApprovals,
              member.id,
              day.isoDate,
              selectedShift
            )
            const { value } = resolveMockRosterCellDisplay(assignment, approval)
            const isWeekBoundary = weekBoundaryDates.has(day.isoDate)

            return (
              <div
                key={day.isoDate}
                className={cn(
                  'h-8 min-w-[26px] flex-1 flex items-center justify-center',
                  day.isWeekend && 'bg-muted/40',
                  isWeekBoundary && 'border-l-2 border-border/70'
                )}
              >
                <span className={cellClass(value, day.isWeekend && value === '')}>{value}</span>
              </div>
            )
          })}
        </div>
      ))}

      {/* Staffing Count row */}
      <div className="flex bg-muted/30 border-b-2 border-border/80">
        <div className="sticky left-0 z-10 min-w-[130px] w-[130px] shrink-0 border-r border-border/80 bg-muted/30 px-2.5 flex items-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground py-1.5 leading-tight">
            Staffing Count
          </span>
        </div>
        {flatDays.map((day) => {
          const count = countFilledForDay(day.isoDate)
          const isWeekBoundary = weekBoundaryDates.has(day.isoDate)
          return (
            <div
              key={day.isoDate}
              className={cn(
                'h-7 min-w-[26px] flex-1 flex items-center justify-center',
                day.isWeekend && 'bg-muted/50',
                isWeekBoundary && 'border-l-2 border-border/70'
              )}
            >
              <span className="text-[10px] font-semibold text-foreground">
                {count > 0 ? count : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
