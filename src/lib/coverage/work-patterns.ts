import { toIsoDate } from '@/lib/calendar-utils'
import type { ShiftTypeForAvailability } from '@/lib/coverage/types'

export type WeekendRotation = 'none' | 'every_other'
export type WorksDowMode = 'hard' | 'soft'

export type WorkPattern = {
  therapist_id: string
  works_dow: number[]
  offs_dow: number[]
  weekend_rotation: WeekendRotation
  weekend_anchor_date: string | null
  works_dow_mode: WorksDowMode
  shift_preference?: 'day' | 'night' | 'either' | null
}

export type PatternDecisionReason =
  | 'blocked_offs_dow'
  | 'blocked_every_other_weekend'
  | 'blocked_outside_works_dow_hard'
  | 'soft_outside_works_dow'
  | 'allowed'

export type PatternDecision = {
  allowed: boolean
  reason: PatternDecisionReason
  penalty: number
}

const SOFT_NON_WORKS_DAY_PENALTY = 25

function parseDate(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function getWeekendSaturday(value: string): string | null {
  const parsed = parseDate(value)
  if (!parsed) return null

  const dow = parsed.getDay()
  if (dow === 6) return toIsoDate(parsed)
  if (dow === 0) {
    const saturday = new Date(parsed)
    saturday.setDate(parsed.getDate() - 1)
    return toIsoDate(saturday)
  }
  return null
}

function getWeekdayIndex(value: string): number | null {
  const parsed = parseDate(value)
  if (!parsed) return null
  return parsed.getDay()
}

export function normalizeDowValues(values: number[] | null | undefined): number[] {
  if (!Array.isArray(values)) return []
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    )
  ).sort((a, b) => a - b)
}

export function normalizeWorkPattern(raw: Partial<WorkPattern> & { therapist_id: string }): WorkPattern {
  const weekendRotation = raw.weekend_rotation === 'every_other' ? 'every_other' : 'none'
  const worksDowMode = raw.works_dow_mode === 'soft' ? 'soft' : 'hard'

  return {
    therapist_id: raw.therapist_id,
    works_dow: normalizeDowValues(raw.works_dow),
    offs_dow: normalizeDowValues(raw.offs_dow),
    weekend_rotation: weekendRotation,
    weekend_anchor_date: raw.weekend_anchor_date ?? null,
    works_dow_mode: worksDowMode,
    shift_preference:
      raw.shift_preference === 'day' || raw.shift_preference === 'night' || raw.shift_preference === 'either'
        ? raw.shift_preference
        : 'either',
  }
}

export function isWeekendOn(pattern: WorkPattern, date: string): boolean {
  const weekendSaturday = getWeekendSaturday(date)
  if (!weekendSaturday) return true
  if (pattern.weekend_rotation !== 'every_other') return true

  const anchorSaturday = pattern.weekend_anchor_date
    ? getWeekendSaturday(pattern.weekend_anchor_date)
    : null
  if (!anchorSaturday) return false

  const weekendDate = parseDate(weekendSaturday)
  const anchorDate = parseDate(anchorSaturday)
  if (!weekendDate || !anchorDate) return false

  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.round((weekendDate.getTime() - anchorDate.getTime()) / dayMs)
  return diffDays % 14 === 0
}

export function isAllowedByPattern(pattern: WorkPattern, date: string): PatternDecision {
  const weekday = getWeekdayIndex(date)
  if (weekday === null) {
    return { allowed: false, reason: 'blocked_offs_dow', penalty: 0 }
  }

  if (pattern.offs_dow.includes(weekday)) {
    return { allowed: false, reason: 'blocked_offs_dow', penalty: 0 }
  }

  const weekendSaturday = getWeekendSaturday(date)
  if (
    weekendSaturday &&
    pattern.weekend_rotation === 'every_other' &&
    !isWeekendOn(pattern, date)
  ) {
    return { allowed: false, reason: 'blocked_every_other_weekend', penalty: 0 }
  }

  const inWorksDow = pattern.works_dow.includes(weekday)
  if (pattern.works_dow_mode === 'hard') {
    if (pattern.works_dow.length === 0 || inWorksDow) {
      return { allowed: true, reason: 'allowed', penalty: 0 }
    }
    return { allowed: false, reason: 'blocked_outside_works_dow_hard', penalty: 0 }
  }

  if (pattern.works_dow.length > 0 && !inWorksDow) {
    return {
      allowed: true,
      reason: 'soft_outside_works_dow',
      penalty: SOFT_NON_WORKS_DAY_PENALTY,
    }
  }

  return { allowed: true, reason: 'allowed', penalty: 0 }
}

export function shiftTypeMatches(overrideShiftType: ShiftTypeForAvailability, shiftType: ShiftTypeForAvailability): boolean {
  return overrideShiftType === 'both' || overrideShiftType === shiftType
}
