import { coverageSlotKey, weeklyCountKey } from '@/lib/schedule-helpers'

type PublishWeeklyInput = {
  therapistIds: string[]
  cycleWeekDates: Map<string, Set<string>>
  weeklyWorkedDatesByUserWeek: Map<string, Set<string>>
  maxWorkDaysPerWeek: number
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
  maxWorkDaysPerWeek,
}: PublishWeeklyInput): PublishWeeklyResult {
  let underCount = 0
  let overCount = 0

  for (const therapistId of therapistIds) {
    for (const [weekStart, weekDatesInCycle] of cycleWeekDates) {
      const requiredDays = Math.min(maxWorkDaysPerWeek, weekDatesInCycle.size)
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
