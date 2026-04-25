import type { AvailabilityOverrideRow, Therapist } from '@/app/schedule/types'
import { getWeekBoundsForDate, pickTherapistForDate, weeklyCountKey } from '@/lib/schedule-helpers'

export const NO_ELIGIBLE_CANDIDATES_REASON = 'no_eligible_candidates_due_to_constraints'

export type FillCoverageSlotArgs = {
  therapists: Therapist[]
  cursor: number
  date: string
  shiftType: 'day' | 'night'
  cycleId: string
  availabilityOverridesByTherapist: Map<string, AvailabilityOverrideRow[]>
  assignedUserIdsForDate: Set<string>
  weeklyWorkedDatesByUserWeek: Map<string, Set<string>>
  workedDatesByUser?: Map<string, Set<string>>
  weeklyLimitByTherapist: Map<string, number>
  weeklyMinimumByTherapist: Map<string, number>
  currentCoverage: number
  targetCoverage: number
  minCoverage: number
}

export type FillCoverageSlotResult = {
  pickedTherapists: Therapist[]
  nextCursor: number
  coverage: number
  unfilledCount: number
  unfilledReason: string | null
}

export function fillCoverageSlot(args: FillCoverageSlotArgs): FillCoverageSlotResult {
  let cursor = args.cursor
  let coverage = args.currentCoverage
  const pickedTherapists: Therapist[] = []
  const workedDatesByUser = args.workedDatesByUser ?? new Map<string, Set<string>>()

  while (coverage < args.targetCoverage) {
    const pick = pickTherapistForDate(
      args.therapists,
      cursor,
      args.date,
      args.shiftType,
      args.availabilityOverridesByTherapist,
      args.cycleId,
      args.assignedUserIdsForDate,
      args.weeklyWorkedDatesByUserWeek,
      args.weeklyLimitByTherapist,
      args.weeklyMinimumByTherapist,
      workedDatesByUser
    )
    cursor = pick.nextCursor

    if (!pick.therapist) {
      break
    }

    const therapist = pick.therapist
    pickedTherapists.push(therapist)
    args.assignedUserIdsForDate.add(therapist.id)

    const weekBounds = getWeekBoundsForDate(args.date)
    if (weekBounds) {
      const key = weeklyCountKey(therapist.id, weekBounds.weekStart)
      const workedDates = args.weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
      workedDates.add(args.date)
      args.weeklyWorkedDatesByUserWeek.set(key, workedDates)
    }
    const allWorkedDates = workedDatesByUser.get(therapist.id) ?? new Set<string>()
    allWorkedDates.add(args.date)
    workedDatesByUser.set(therapist.id, allWorkedDates)

    coverage += 1
  }

  if (coverage >= args.minCoverage) {
    return {
      pickedTherapists,
      nextCursor: cursor,
      coverage,
      unfilledCount: 0,
      unfilledReason: null,
    }
  }

  return {
    pickedTherapists,
    nextCursor: cursor,
    coverage,
    unfilledCount: args.minCoverage - coverage,
    unfilledReason: NO_ELIGIBLE_CANDIDATES_REASON,
  }
}
