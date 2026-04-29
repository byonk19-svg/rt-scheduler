import type { ScheduleRosterLivePayload } from '@/app/(app)/schedule/schedule-roster-live-data'
import type {
  AvailabilityApprovalStore,
  AssignmentStore,
  ShiftType,
  Staff,
} from '@/lib/mock-coverage-roster'
import {
  buildRosterWeeks,
  getAssignment,
  getAvailabilityApproval,
  resolveMockRosterCellDisplay,
} from '@/lib/mock-coverage-roster'
import { splitStaffByRosterAndShift } from '@/lib/schedule-roster-data'

import type {
  ScheduleDataset,
  ScheduleDay,
  ScheduleRow,
  ScheduleWeek,
} from '@/components/schedule-roster/mock-schedule-data'

function toScheduleWeeks(startDate: string, endDate: string): ScheduleWeek[] {
  return buildRosterWeeks(startDate, endDate).map((week, weekIndex) => ({
    id: week.id,
    label: week.label,
    startIso: week.startDate,
    endIso: week.days[week.days.length - 1]?.isoDate ?? week.startDate,
    days: week.days.map((day, dayIndex) => ({
      isoDate: day.isoDate,
      dowLabel: day.dayLabel,
      dayNumber: day.dayNumber,
      weekIndex,
      isWeekend: day.isWeekend,
      isWeekStart: dayIndex === 0,
    })),
  }))
}

function resolveCode(
  assignments: AssignmentStore,
  availabilityApprovals: AvailabilityApprovalStore,
  member: Staff,
  day: ScheduleDay,
  shiftType: ShiftType
) {
  return resolveMockRosterCellDisplay(
    getAssignment(assignments, member.id, day.isoDate, shiftType),
    getAvailabilityApproval(availabilityApprovals, member.id, day.isoDate, shiftType)
  )
}

function buildRows(
  staff: readonly Staff[],
  days: readonly ScheduleDay[],
  assignments: AssignmentStore,
  availabilityApprovals: AvailabilityApprovalStore,
  shiftType: ShiftType,
  section: 'core' | 'prn'
): ScheduleRow[] {
  return staff.map((member) => ({
    id: member.id,
    name: member.name,
    section,
    codes: days.map(
      (day) => resolveCode(assignments, availabilityApprovals, member, day, shiftType).value
    ),
  }))
}

function buildCounts(
  staff: readonly Staff[],
  days: readonly ScheduleDay[],
  assignments: AssignmentStore,
  availabilityApprovals: AvailabilityApprovalStore,
  shiftType: ShiftType
): number[] {
  return days.map((day) =>
    staff.reduce((total, member) => {
      const { countsTowardDayTally } = resolveCode(
        assignments,
        availabilityApprovals,
        member,
        day,
        shiftType
      )
      return total + (countsTowardDayTally ? 1 : 0)
    }, 0)
  )
}

export function buildLiveScheduleDataset(
  live: ScheduleRosterLivePayload,
  shiftType: ShiftType
): ScheduleDataset {
  const weeks = toScheduleWeeks(live.startDate, live.endDate)
  const days = weeks.flatMap((week) => week.days)
  const sections = splitStaffByRosterAndShift(live.staff, shiftType)

  return {
    shift: shiftType,
    title: `Respiratory Therapy ${shiftType === 'day' ? 'Day' : 'Night'} Shift`,
    cycleLabel: `${live.label} (${live.shortLabel})`,
    weeks,
    coreRows: buildRows(
      sections.core,
      days,
      live.assignments,
      live.availabilityApprovals,
      shiftType,
      'core'
    ),
    prnRows: buildRows(
      sections.prn,
      days,
      live.assignments,
      live.availabilityApprovals,
      shiftType,
      'prn'
    ),
    coreCounts: buildCounts(
      sections.core,
      days,
      live.assignments,
      live.availabilityApprovals,
      shiftType
    ),
    prnCounts: buildCounts(
      sections.prn,
      days,
      live.assignments,
      live.availabilityApprovals,
      shiftType
    ),
    openShifts: [],
    pendingRequests: [],
    warnings: [],
    summary: [],
  }
}
