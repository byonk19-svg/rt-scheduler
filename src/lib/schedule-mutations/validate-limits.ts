import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import { countsTowardWeeklyLimit, getWeekBoundsForDate } from '@/lib/schedule-helpers'
import { exceedsCoverageLimit, exceedsWeeklyLimit } from '@/lib/schedule-rule-validation'
import {
  MAX_SHIFT_COVERAGE_PER_DAY,
  MAX_WORK_DAYS_PER_WEEK,
  getDefaultWeeklyLimitForEmploymentType,
  sanitizeWeeklyLimit,
  type EmploymentType,
} from '@/lib/scheduling-constants'
import {
  SCHEDULE_MUTATION_ERROR_CODES as ERROR_CODES,
  type ScheduleMutationErrorCode,
} from '@/lib/schedule-mutations/errors'
import type { createClient } from '@/lib/supabase/server'
import type { ShiftStatus } from '@/app/schedule/types'

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>
type ShiftType = 'day' | 'night'

type ScheduleMutationLimitFailure = {
  ok: false
  status: 409 | 500
  error: string
  code: ScheduleMutationErrorCode
}

export type ScheduleMutationLimitValidationResult =
  | {
      ok: true
    }
  | ScheduleMutationLimitFailure

export async function validateScheduleMutationLimits(
  supabase: ScheduleMutationSupabaseClient,
  params: {
    therapistId: string
    managerSiteId: string
    cycleId: string
    date: string
    shiftType: ShiftType
    overrideWeeklyRules: boolean
    excludeShiftId?: string
    shiftStatus?: ShiftStatus
  }
): Promise<ScheduleMutationLimitValidationResult> {
  if (params.overrideWeeklyRules) return { ok: true }
  if (params.shiftStatus !== undefined && !countsTowardWeeklyLimit(params.shiftStatus)) {
    return { ok: true }
  }

  const coverage = await getCoverageCountForSlot(
    supabase,
    params.cycleId,
    params.date,
    params.shiftType,
    params.excludeShiftId
  )
  if (coverage.error) {
    return {
      ok: false,
      status: 500,
      error: 'Failed to validate daily coverage limit.',
      code: ERROR_CODES.internalError,
    }
  }

  if (exceedsCoverageLimit(coverage.count, MAX_SHIFT_COVERAGE_PER_DAY)) {
    return {
      ok: false,
      status: 409,
      error: `Each shift can have at most ${MAX_SHIFT_COVERAGE_PER_DAY} scheduled team members.`,
      code: ERROR_CODES.coverageLimitExceeded,
    }
  }

  const weekly = await getWorkedDatesInWeek(
    supabase,
    params.therapistId,
    params.date,
    params.excludeShiftId
  )
  if (weekly.error) {
    return {
      ok: false,
      status: 500,
      error: 'Failed to validate weekly rule',
      code: ERROR_CODES.internalError,
    }
  }

  const weeklyLimit = await getTherapistWeeklyLimit(
    supabase,
    params.therapistId,
    params.managerSiteId
  )
  if (exceedsWeeklyLimit(weekly.dates, params.date, weeklyLimit)) {
    return {
      ok: false,
      status: 409,
      error: `Therapists are limited to ${weeklyLimit} day(s) per week unless override is enabled.`,
      code: ERROR_CODES.weeklyLimitExceeded,
    }
  }

  return { ok: true }
}

async function getCoverageCountForSlot(
  supabase: ScheduleMutationSupabaseClient,
  cycleId: string,
  date: string,
  shiftType: ShiftType,
  excludeShiftId?: string
): Promise<{ count: number; error?: string }> {
  let query = supabase
    .from('shifts')
    .select('id, status')
    .eq('cycle_id', cycleId)
    .eq('date', date)
    .eq('shift_type', shiftType)

  if (excludeShiftId) {
    query = query.neq('id', excludeShiftId)
  }

  const { data, error } = await query
  if (error) return { count: 0, error: error.message }

  const slotRows = (data ?? []) as Array<{ id: string }>
  const activeOperationalCodesByShiftId = await fetchActiveOperationalCodeMap(
    supabase,
    slotRows.map((shift) => shift.id)
  )
  const count = slotRows.filter((shift) => !activeOperationalCodesByShiftId.has(shift.id)).length
  return { count }
}

async function getWorkedDatesInWeek(
  supabase: ScheduleMutationSupabaseClient,
  userId: string,
  targetDate: string,
  excludeShiftId?: string
): Promise<{ dates: Set<string>; error?: string }> {
  const bounds = getWeekBoundsForDate(targetDate)
  if (!bounds) return { dates: new Set<string>(), error: 'Invalid target date' }

  let query = supabase
    .from('shifts')
    .select('id, date, status')
    .eq('user_id', userId)
    .gte('date', bounds.weekStart)
    .lte('date', bounds.weekEnd)

  if (excludeShiftId) {
    query = query.neq('id', excludeShiftId)
  }

  const { data, error } = await query
  if (error) return { dates: new Set<string>(), error: error.message }

  const workedDates = new Set<string>()
  for (const shift of data ?? []) {
    if (!countsTowardWeeklyLimit(shift.status as ShiftStatus)) continue
    workedDates.add(shift.date as string)
  }
  return { dates: workedDates }
}

async function getTherapistWeeklyLimit(
  supabase: ScheduleMutationSupabaseClient,
  therapistId: string,
  siteId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('max_work_days_per_week, employment_type')
    .eq('id', therapistId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (error) return MAX_WORK_DAYS_PER_WEEK

  const profile = data as {
    max_work_days_per_week: number | null
    employment_type: EmploymentType | null
  } | null
  const fallback = getDefaultWeeklyLimitForEmploymentType(profile?.employment_type)
  return sanitizeWeeklyLimit(profile?.max_work_days_per_week, fallback)
}
