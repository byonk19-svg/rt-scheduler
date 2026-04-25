import type {
  AutoScheduleShiftRow,
  AvailabilityOverrideRow,
  ShiftRole,
  ShiftLimitRow,
  Therapist,
} from '@/app/schedule/types'
import { shiftTypeMatches } from '@/lib/coverage/work-patterns'
import { fillCoverageSlot, NO_ELIGIBLE_CANDIDATES_REASON } from '@/lib/coverage/generator-slot'
import { getAutoDraftCoveragePolicy } from '@/lib/coverage/auto-draft-policy'
import {
  MAX_WORK_DAYS_PER_WEEK,
  MIN_SHIFT_COVERAGE_PER_DAY,
  getDefaultWeeklyLimitForEmploymentType,
  getWeeklyMinimumForEmploymentType,
  sanitizeWeeklyLimit,
} from '@/lib/scheduling-constants'
import {
  buildDateRange,
  countsTowardWeeklyLimit,
  coverageSlotKey,
  getWeekBoundsForDate,
  pickTherapistForDate,
  weeklyCountKey,
} from '@/lib/schedule-helpers'

export type DraftShiftInsert = {
  cycle_id: string
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  status: 'scheduled'
  role: ShiftRole
}

export type GenerateDraftInput = {
  cycleId: string
  cycleStartDate: string
  cycleEndDate: string
  therapists: Therapist[]
  existingShifts: AutoScheduleShiftRow[]
  allAvailabilityOverrides: AvailabilityOverrideRow[]
  weeklyShifts: ShiftLimitRow[]
}

export type GenerateDraftResult = {
  draftShiftsToInsert: DraftShiftInsert[]
  pendingLeadUpdates: Array<{ date: string; shiftType: 'day' | 'night'; therapistId: string }>
  unfilledConstraintSlots: Array<{ date: string; shiftType: 'day' | 'night'; missingCount: number }>
  unfilledSlots: number
  constraintsUnfilledSlots: number
  missingLeadSlots: number
  forcedMustWorkMisses: number
}

export function generateDraftForCycle(input: GenerateDraftInput): GenerateDraftResult {
  const {
    cycleId,
    cycleStartDate,
    cycleEndDate,
    therapists,
    existingShifts,
    allAvailabilityOverrides,
    weeklyShifts,
  } = input

  const AUTO_GENERATE_TARGET_COVERAGE_PER_SHIFT = getAutoDraftCoveragePolicy().idealCoveragePerShift

  const weeklyLimitByTherapist = new Map<string, number>(
    therapists.map((therapist) => [
      therapist.id,
      sanitizeWeeklyLimit(
        therapist.max_work_days_per_week,
        getDefaultWeeklyLimitForEmploymentType(therapist.employment_type)
      ),
    ])
  )
  const weeklyMinimumByTherapist = new Map<string, number>(
    therapists.map((therapist) => {
      const weeklyLimit = weeklyLimitByTherapist.get(therapist.id) ?? MAX_WORK_DAYS_PER_WEEK
      const baselineMinimum = getWeeklyMinimumForEmploymentType(therapist.employment_type)
      return [therapist.id, Math.min(weeklyLimit, baselineMinimum)]
    })
  )

  const cycleDates = buildDateRange(cycleStartDate, cycleEndDate)

  const availabilityOverridesByTherapist = new Map<string, AvailabilityOverrideRow[]>()
  for (const row of allAvailabilityOverrides) {
    const therapistId = row.therapist_id
    const rows = availabilityOverridesByTherapist.get(therapistId) ?? []
    rows.push(row)
    availabilityOverridesByTherapist.set(therapistId, rows)
  }

  const weeklyWorkedDatesByUserWeek = new Map<string, Set<string>>()
  const workedDatesByUser = new Map<string, Set<string>>()
  for (const row of weeklyShifts) {
    if (!countsTowardWeeklyLimit(row.status)) continue
    const bounds = getWeekBoundsForDate(row.date)
    if (!bounds) continue

    const key = weeklyCountKey(row.user_id, bounds.weekStart)
    const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
    workedDates.add(row.date)
    weeklyWorkedDatesByUserWeek.set(key, workedDates)
    const allWorkedDates = workedDatesByUser.get(row.user_id) ?? new Set<string>()
    allWorkedDates.add(row.date)
    workedDatesByUser.set(row.user_id, allWorkedDates)
  }

  const coverageBySlot = new Map<string, number>()
  const assignedUserIdsByDate = new Map<string, Set<string>>()
  const leadAssignedBySlot = new Map<string, boolean>()
  const shiftsBySlot = new Map<string, AutoScheduleShiftRow[]>()
  const therapistById = new Map(therapists.map((therapist) => [therapist.id, therapist]))
  for (const shift of existingShifts) {
    const slotKey = coverageSlotKey(shift.date, shift.shift_type)
    const slotShifts = shiftsBySlot.get(slotKey) ?? []
    slotShifts.push(shift)
    shiftsBySlot.set(slotKey, slotShifts)

    if (shift.role === 'lead') {
      leadAssignedBySlot.set(slotKey, true)
    }

    if (countsTowardWeeklyLimit(shift.status)) {
      const coverage = coverageBySlot.get(slotKey) ?? 0
      coverageBySlot.set(slotKey, coverage + 1)
    }
    const assignedForDate = assignedUserIdsByDate.get(shift.date) ?? new Set<string>()
    assignedForDate.add(shift.user_id)
    assignedUserIdsByDate.set(shift.date, assignedForDate)
  }

  const dayTherapists = therapists.filter((therapist) => therapist.shift_type === 'day')
  const nightTherapists = therapists.filter((therapist) => therapist.shift_type === 'night')
  const dayLeadTherapists = dayTherapists.filter((therapist) => therapist.is_lead_eligible)
  const nightLeadTherapists = nightTherapists.filter((therapist) => therapist.is_lead_eligible)

  let dayCursor = 0
  let nightCursor = 0
  let dayLeadCursor = 0
  let nightLeadCursor = 0
  let unfilledSlots = 0
  let constraintsUnfilledSlots = 0
  let missingLeadSlots = 0
  const pendingLeadUpdates: GenerateDraftResult['pendingLeadUpdates'] = []
  const unfilledConstraintSlots: GenerateDraftResult['unfilledConstraintSlots'] = []

  const draftShiftsToInsert: DraftShiftInsert[] = []

  for (const date of cycleDates) {
    const assignedForDate = assignedUserIdsByDate.get(date) ?? new Set<string>()
    assignedUserIdsByDate.set(date, assignedForDate)

    const daySlotKey = coverageSlotKey(date, 'day')
    let dayCoverage = coverageBySlot.get(daySlotKey) ?? 0
    let dayHasLead = leadAssignedBySlot.get(daySlotKey) === true

    if (!dayHasLead) {
      const existingDayLeadCandidate = (shiftsBySlot.get(daySlotKey) ?? []).find((shift) => {
        if (!countsTowardWeeklyLimit(shift.status)) return false
        return therapistById.get(shift.user_id)?.is_lead_eligible === true
      })
      if (existingDayLeadCandidate) {
        pendingLeadUpdates.push({
          date,
          shiftType: 'day',
          therapistId: existingDayLeadCandidate.user_id,
        })
        dayHasLead = true
        leadAssignedBySlot.set(daySlotKey, true)
      }
    }

    if (!dayHasLead) {
      const dayLeadPick = pickTherapistForDate(
        dayLeadTherapists,
        dayLeadCursor,
        date,
        'day',
        availabilityOverridesByTherapist,
        cycleId,
        assignedForDate,
        weeklyWorkedDatesByUserWeek,
        weeklyLimitByTherapist,
        weeklyMinimumByTherapist,
        workedDatesByUser
      )
      dayLeadCursor = dayLeadPick.nextCursor

      if (dayLeadPick.therapist) {
        draftShiftsToInsert.push({
          cycle_id: cycleId,
          user_id: dayLeadPick.therapist.id,
          date,
          shift_type: 'day',
          status: 'scheduled',
          role: 'lead',
        })
        assignedForDate.add(dayLeadPick.therapist.id)
        const weekBounds = getWeekBoundsForDate(date)
        if (weekBounds) {
          const key = weeklyCountKey(dayLeadPick.therapist.id, weekBounds.weekStart)
          const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
          workedDates.add(date)
          weeklyWorkedDatesByUserWeek.set(key, workedDates)
        }
        const allWorkedDates = workedDatesByUser.get(dayLeadPick.therapist.id) ?? new Set<string>()
        allWorkedDates.add(date)
        workedDatesByUser.set(dayLeadPick.therapist.id, allWorkedDates)
        dayCoverage += 1
        coverageBySlot.set(daySlotKey, dayCoverage)
        dayHasLead = true
        leadAssignedBySlot.set(daySlotKey, true)
      }
    }

    const dayFill = fillCoverageSlot({
      therapists: dayTherapists,
      cursor: dayCursor,
      date,
      shiftType: 'day',
      cycleId,
      availabilityOverridesByTherapist,
      assignedUserIdsForDate: assignedForDate,
      weeklyWorkedDatesByUserWeek,
      weeklyLimitByTherapist,
      weeklyMinimumByTherapist,
      workedDatesByUser,
      currentCoverage: dayCoverage,
      targetCoverage: AUTO_GENERATE_TARGET_COVERAGE_PER_SHIFT,
      minCoverage: MIN_SHIFT_COVERAGE_PER_DAY,
    })
    dayCursor = dayFill.nextCursor
    for (const pickedTherapist of dayFill.pickedTherapists) {
      const roleForDayShift: ShiftRole =
        !dayHasLead && pickedTherapist.is_lead_eligible ? 'lead' : 'staff'
      draftShiftsToInsert.push({
        cycle_id: cycleId,
        user_id: pickedTherapist.id,
        date,
        shift_type: 'day',
        status: 'scheduled',
        role: roleForDayShift,
      })
      if (roleForDayShift === 'lead') {
        dayHasLead = true
        leadAssignedBySlot.set(daySlotKey, true)
      }
      const allWorkedDates = workedDatesByUser.get(pickedTherapist.id) ?? new Set<string>()
      allWorkedDates.add(date)
      workedDatesByUser.set(pickedTherapist.id, allWorkedDates)
    }
    dayCoverage = dayFill.coverage
    coverageBySlot.set(daySlotKey, dayCoverage)
    if (dayFill.unfilledCount > 0) {
      unfilledSlots += dayFill.unfilledCount
      constraintsUnfilledSlots += dayFill.unfilledCount
      if (dayFill.unfilledReason === NO_ELIGIBLE_CANDIDATES_REASON) {
        unfilledConstraintSlots.push({
          date,
          shiftType: 'day',
          missingCount: dayFill.unfilledCount,
        })
      }
    }

    if (!dayHasLead) {
      missingLeadSlots += 1
    }

    const nightSlotKey = coverageSlotKey(date, 'night')
    let nightCoverage = coverageBySlot.get(nightSlotKey) ?? 0
    let nightHasLead = leadAssignedBySlot.get(nightSlotKey) === true

    if (!nightHasLead) {
      const existingNightLeadCandidate = (shiftsBySlot.get(nightSlotKey) ?? []).find((shift) => {
        if (!countsTowardWeeklyLimit(shift.status)) return false
        return therapistById.get(shift.user_id)?.is_lead_eligible === true
      })
      if (existingNightLeadCandidate) {
        pendingLeadUpdates.push({
          date,
          shiftType: 'night',
          therapistId: existingNightLeadCandidate.user_id,
        })
        nightHasLead = true
        leadAssignedBySlot.set(nightSlotKey, true)
      }
    }

    if (!nightHasLead) {
      const nightLeadPick = pickTherapistForDate(
        nightLeadTherapists,
        nightLeadCursor,
        date,
        'night',
        availabilityOverridesByTherapist,
        cycleId,
        assignedForDate,
        weeklyWorkedDatesByUserWeek,
        weeklyLimitByTherapist,
        weeklyMinimumByTherapist,
        workedDatesByUser
      )
      nightLeadCursor = nightLeadPick.nextCursor

      if (nightLeadPick.therapist) {
        draftShiftsToInsert.push({
          cycle_id: cycleId,
          user_id: nightLeadPick.therapist.id,
          date,
          shift_type: 'night',
          status: 'scheduled',
          role: 'lead',
        })
        assignedForDate.add(nightLeadPick.therapist.id)
        const weekBounds = getWeekBoundsForDate(date)
        if (weekBounds) {
          const key = weeklyCountKey(nightLeadPick.therapist.id, weekBounds.weekStart)
          const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
          workedDates.add(date)
          weeklyWorkedDatesByUserWeek.set(key, workedDates)
        }
        const allWorkedDates = workedDatesByUser.get(nightLeadPick.therapist.id) ?? new Set<string>()
        allWorkedDates.add(date)
        workedDatesByUser.set(nightLeadPick.therapist.id, allWorkedDates)
        nightCoverage += 1
        coverageBySlot.set(nightSlotKey, nightCoverage)
        nightHasLead = true
        leadAssignedBySlot.set(nightSlotKey, true)
      }
    }

    const nightFill = fillCoverageSlot({
      therapists: nightTherapists,
      cursor: nightCursor,
      date,
      shiftType: 'night',
      cycleId,
      availabilityOverridesByTherapist,
      assignedUserIdsForDate: assignedForDate,
      weeklyWorkedDatesByUserWeek,
      weeklyLimitByTherapist,
      weeklyMinimumByTherapist,
      workedDatesByUser,
      currentCoverage: nightCoverage,
      targetCoverage: AUTO_GENERATE_TARGET_COVERAGE_PER_SHIFT,
      minCoverage: MIN_SHIFT_COVERAGE_PER_DAY,
    })
    nightCursor = nightFill.nextCursor
    for (const pickedTherapist of nightFill.pickedTherapists) {
      const roleForNightShift: ShiftRole =
        !nightHasLead && pickedTherapist.is_lead_eligible ? 'lead' : 'staff'
      draftShiftsToInsert.push({
        cycle_id: cycleId,
        user_id: pickedTherapist.id,
        date,
        shift_type: 'night',
        status: 'scheduled',
        role: roleForNightShift,
      })
      if (roleForNightShift === 'lead') {
        nightHasLead = true
        leadAssignedBySlot.set(nightSlotKey, true)
      }
      const allWorkedDates = workedDatesByUser.get(pickedTherapist.id) ?? new Set<string>()
      allWorkedDates.add(date)
      workedDatesByUser.set(pickedTherapist.id, allWorkedDates)
    }
    nightCoverage = nightFill.coverage
    coverageBySlot.set(nightSlotKey, nightCoverage)
    if (nightFill.unfilledCount > 0) {
      unfilledSlots += nightFill.unfilledCount
      constraintsUnfilledSlots += nightFill.unfilledCount
      if (nightFill.unfilledReason === NO_ELIGIBLE_CANDIDATES_REASON) {
        unfilledConstraintSlots.push({
          date,
          shiftType: 'night',
          missingCount: nightFill.unfilledCount,
        })
      }
    }

    if (!nightHasLead) {
      missingLeadSlots += 1
    }
  }

  const finalAssignedShifts = [...existingShifts, ...draftShiftsToInsert]
  const forcedMustWorkMisses = allAvailabilityOverrides.filter((override) => {
    if (override.override_type !== 'force_on') return false
    if (override.source !== 'manager' && override.source !== 'therapist') return false

    return !finalAssignedShifts.some((shift) => {
      if (shift.user_id !== override.therapist_id || shift.date !== override.date) return false
      if (!countsTowardWeeklyLimit(shift.status)) return false
      return shiftTypeMatches(override.shift_type, shift.shift_type)
    })
  }).length

  return {
    draftShiftsToInsert,
    pendingLeadUpdates,
    unfilledConstraintSlots,
    unfilledSlots,
    constraintsUnfilledSlots,
    missingLeadSlots,
    forcedMustWorkMisses,
  }
}
