export const MAX_WORK_DAYS_PER_WEEK = 3
export const MIN_SHIFT_COVERAGE_PER_DAY = 3
export const MAX_SHIFT_COVERAGE_PER_DAY = 5

export const PART_TIME_MAX_WORK_DAYS_PER_WEEK = 2
export const PRN_MAX_WORK_DAYS_PER_WEEK = 1

export type EmploymentType = 'full_time' | 'part_time' | 'prn'

export function getDefaultWeeklyLimitForEmploymentType(
  employmentType: string | null | undefined
): number {
  if (employmentType === 'part_time') return PART_TIME_MAX_WORK_DAYS_PER_WEEK
  if (employmentType === 'prn') return PRN_MAX_WORK_DAYS_PER_WEEK
  return MAX_WORK_DAYS_PER_WEEK
}

export function sanitizeWeeklyLimit(
  value: number | null | undefined,
  fallback: number = MAX_WORK_DAYS_PER_WEEK
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const rounded = Math.trunc(value)
  if (rounded < 1 || rounded > 7) return fallback
  return rounded
}
