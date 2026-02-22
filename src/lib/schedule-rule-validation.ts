import { coverageSlotKey, weeklyCountKey } from '@/lib/schedule-helpers'
import type { ShiftRole, ShiftStatus } from '@/app/schedule/types'
import { MAX_WORK_DAYS_PER_WEEK } from '@/lib/scheduling-constants'

type PublishWeeklyInput = {
  therapistIds: string[]
  cycleWeekDates: Map<string, Set<string>>
  weeklyWorkedDatesByUserWeek: Map<string, Set<string>>
  maxWorkDaysByTherapist: Map<string, number>
}

type PublishWeeklyResult = {
  underCount: number
  overCount: number
  violations: number
}

type CoverageValidationInput = {
  cycleDates: string[]
  coverageBySlot: Map<string, number>
  minCoveragePerShift: number
  maxCoveragePerShift: number
}

type CoverageValidationResult = {
  underCoverage: number
  overCoverage: number
  violations: number
}

export type SlotAssignment = {
  date: string
  shiftType: 'day' | 'night'
  status: ShiftStatus
  role: ShiftRole
  therapistId: string
  therapistName: string
  isLeadEligible: boolean
}

type ShiftSlotValidationInput = {
  cycleDates: string[]
  assignments: SlotAssignment[]
  minCoveragePerShift: number
  maxCoveragePerShift: number
}

export type ShiftSlotValidationIssue = {
  slotKey: string
  date: string
  shiftType: 'day' | 'night'
  reasons: Array<'under_coverage' | 'over_coverage' | 'missing_lead' | 'multiple_leads' | 'ineligible_lead'>
  leadName: string | null
}

export type ShiftSlotValidationSummary = {
  underCoverage: number
  overCoverage: number
  missingLead: number
  multipleLeads: number
  ineligibleLead: number
  violations: number
  issues: ShiftSlotValidationIssue[]
}

export function exceedsCoverageLimit(activeCoverage: number, maxCoveragePerShift: number): boolean {
  return activeCoverage >= maxCoveragePerShift
}

export function exceedsWeeklyLimit(
  workedDates: Set<string>,
  targetDate: string,
  maxWorkDaysPerWeek: number
): boolean {
  return !workedDates.has(targetDate) && workedDates.size >= maxWorkDaysPerWeek
}

export function summarizePublishWeeklyViolations({
  therapistIds,
  cycleWeekDates,
  weeklyWorkedDatesByUserWeek,
  maxWorkDaysByTherapist,
}: PublishWeeklyInput): PublishWeeklyResult {
  let underCount = 0
  let overCount = 0

  for (const therapistId of therapistIds) {
    const therapistMaxWorkDays = maxWorkDaysByTherapist.get(therapistId) ?? MAX_WORK_DAYS_PER_WEEK
    for (const [weekStart, weekDatesInCycle] of cycleWeekDates) {
      const requiredDays = Math.min(therapistMaxWorkDays, weekDatesInCycle.size)
      const workedDates =
        weeklyWorkedDatesByUserWeek.get(weeklyCountKey(therapistId, weekStart)) ?? new Set<string>()
      const workedCount = workedDates.size

      if (workedCount < requiredDays) underCount += 1
      if (workedCount > requiredDays) overCount += 1
    }
  }

  return { underCount, overCount, violations: underCount + overCount }
}

export function summarizeCoverageViolations({
  cycleDates,
  coverageBySlot,
  minCoveragePerShift,
  maxCoveragePerShift,
}: CoverageValidationInput): CoverageValidationResult {
  let underCoverage = 0
  let overCoverage = 0

  for (const date of cycleDates) {
    for (const shiftType of ['day', 'night'] as const) {
      const count = coverageBySlot.get(coverageSlotKey(date, shiftType)) ?? 0
      if (count < minCoveragePerShift) underCoverage += 1
      if (count > maxCoveragePerShift) overCoverage += 1
    }
  }

  return { underCoverage, overCoverage, violations: underCoverage + overCoverage }
}

export function summarizeShiftSlotViolations({
  cycleDates,
  assignments,
  minCoveragePerShift,
  maxCoveragePerShift,
}: ShiftSlotValidationInput): ShiftSlotValidationSummary {
  const assignmentsBySlot = new Map<string, SlotAssignment[]>()
  for (const assignment of assignments) {
    const slotKey = coverageSlotKey(assignment.date, assignment.shiftType)
    const slotAssignments = assignmentsBySlot.get(slotKey) ?? []
    slotAssignments.push(assignment)
    assignmentsBySlot.set(slotKey, slotAssignments)
  }

  const issues: ShiftSlotValidationIssue[] = []
  let underCoverage = 0
  let overCoverage = 0
  let missingLead = 0
  let multipleLeads = 0
  let ineligibleLead = 0

  for (const date of cycleDates) {
    for (const shiftType of ['day', 'night'] as const) {
      const slotKey = coverageSlotKey(date, shiftType)
      const slotAssignments = assignmentsBySlot.get(slotKey) ?? []
      const activeAssignments = slotAssignments.filter((assignment) => assignment.status === 'scheduled' || assignment.status === 'on_call')
      const activeCoverage = activeAssignments.length
      const leadAssignments = slotAssignments.filter((assignment) => assignment.role === 'lead')
      const hasEligibleCoverage = activeAssignments.some((assignment) => assignment.isLeadEligible)
      const leadName = leadAssignments[0]?.therapistName ?? null

      const reasons: ShiftSlotValidationIssue['reasons'] = []
      if (activeCoverage < minCoveragePerShift) {
        underCoverage += 1
        reasons.push('under_coverage')
      }
      if (activeCoverage > maxCoveragePerShift) {
        overCoverage += 1
        reasons.push('over_coverage')
      }
      if (leadAssignments.length === 0 || !hasEligibleCoverage) {
        missingLead += 1
        reasons.push('missing_lead')
      }
      if (leadAssignments.length > 1) {
        multipleLeads += 1
        reasons.push('multiple_leads')
      }
      if (leadAssignments.length > 0 && leadAssignments.some((assignment) => !assignment.isLeadEligible)) {
        ineligibleLead += 1
        reasons.push('ineligible_lead')
      }

      if (reasons.length > 0) {
        issues.push({
          slotKey,
          date,
          shiftType,
          reasons,
          leadName,
        })
      }
    }
  }

  return {
    underCoverage,
    overCoverage,
    missingLead,
    multipleLeads,
    ineligibleLead,
    violations: underCoverage + overCoverage + missingLead + multipleLeads + ineligibleLead,
    issues,
  }
}
