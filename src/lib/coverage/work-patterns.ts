import { toIsoDate } from '@/lib/calendar-utils'
import type { ShiftTypeForAvailability } from '@/lib/coverage/types'

export type WeekendRotation = 'none' | 'every_other'
export type WorksDowMode = 'hard' | 'soft'
export type RecurringPatternType =
  | 'weekly_fixed'
  | 'weekly_with_weekend_rotation'
  | 'repeating_cycle'
  | 'none'
export type WeekendRule = 'none' | 'every_weekend' | 'every_other_weekend'
export type WorkPatternCycleSegment = {
  kind: 'work' | 'off'
  length_days: number
}

export type WorkPattern = {
  therapist_id: string
  pattern_type: RecurringPatternType
  works_dow: number[]
  offs_dow: number[]
  weekend_rotation: WeekendRotation
  weekend_anchor_date: string | null
  works_dow_mode: WorksDowMode
  shift_preference?: 'day' | 'night' | 'either' | null
  weekly_weekdays: number[]
  weekend_rule: WeekendRule
  cycle_anchor_date: string | null
  cycle_segments: WorkPatternCycleSegment[]
}

export type PatternDecisionReason =
  | 'blocked_offs_dow'
  | 'blocked_every_other_weekend'
  | 'blocked_outside_works_dow_hard'
  | 'soft_outside_works_dow'
  | 'blocked_repeating_cycle_off_segment'
  | 'allowed'

export type PatternDecision = {
  allowed: boolean
  reason: PatternDecisionReason
  penalty: number
}

const SOFT_NON_WORKS_DAY_PENALTY = 25
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function parseDate(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function formatLongDate(value: string): string {
  const parsed = parseDate(value)
  if (!parsed) return value
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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

function normalizeWeekendRule(
  rule: string | null | undefined,
  legacyWeekendRotation: string | null | undefined
): WeekendRule {
  if (rule === 'every_weekend' || rule === 'every_other_weekend' || rule === 'none') {
    return rule
  }
  if (legacyWeekendRotation === 'every_other') return 'every_other_weekend'
  return 'none'
}

function normalizePatternType(raw: Partial<WorkPattern>): RecurringPatternType {
  if (
    raw.pattern_type === 'weekly_fixed' ||
    raw.pattern_type === 'weekly_with_weekend_rotation' ||
    raw.pattern_type === 'repeating_cycle' ||
    raw.pattern_type === 'none'
  ) {
    return raw.pattern_type
  }

  const hasCycleSegments = Array.isArray(raw.cycle_segments) && raw.cycle_segments.length > 0
  if (hasCycleSegments || raw.cycle_anchor_date) {
    return 'repeating_cycle'
  }

  const weekendRule = normalizeWeekendRule(raw.weekend_rule, raw.weekend_rotation)
  const weeklyWeekdays = normalizeDowValues(raw.weekly_weekdays ?? raw.works_dow)
  const legacyOffs = normalizeDowValues(raw.offs_dow)
  if (weekendRule !== 'none') return 'weekly_with_weekend_rotation'
  if (weeklyWeekdays.length > 0 || legacyOffs.length > 0) return 'weekly_fixed'

  return 'none'
}

function normalizeCycleSegments(
  rawSegments: unknown
): WorkPatternCycleSegment[] {
  if (!Array.isArray(rawSegments)) return []

  const normalized: WorkPatternCycleSegment[] = []
  for (const entry of rawSegments) {
    if (!entry || typeof entry !== 'object') continue
    const kind = (entry as { kind?: unknown }).kind
    const lengthDaysRaw = (entry as { length_days?: unknown }).length_days
    const lengthDays = Number(lengthDaysRaw)
    if ((kind !== 'work' && kind !== 'off') || !Number.isInteger(lengthDays) || lengthDays < 1) {
      continue
    }
    const prior = normalized[normalized.length - 1]
    if (prior && prior.kind === kind) {
      prior.length_days += lengthDays
      continue
    }
    normalized.push({ kind, length_days: lengthDays })
  }
  return normalized
}

function buildLegacyWeeklyMirror(params: {
  patternType: RecurringPatternType
  weeklyWeekdays: number[]
  weekendRule: WeekendRule
}): Pick<WorkPattern, 'works_dow' | 'offs_dow' | 'weekend_rotation'> {
  const weekdayOnly = params.weeklyWeekdays.filter((day) => day >= 1 && day <= 5)
  const weekendDays = [0, 6]

  if (params.patternType === 'weekly_with_weekend_rotation') {
    if (params.weekendRule === 'every_weekend') {
      return {
        works_dow: normalizeDowValues([...weekdayOnly, ...weekendDays]),
        offs_dow: [],
        weekend_rotation: 'none',
      }
    }
    if (params.weekendRule === 'every_other_weekend') {
      return {
        works_dow: normalizeDowValues([...weekdayOnly, ...weekendDays]),
        offs_dow: [],
        weekend_rotation: 'every_other',
      }
    }
    return {
      works_dow: weekdayOnly,
      offs_dow: weekendDays,
      weekend_rotation: 'none',
    }
  }

  if (params.patternType === 'weekly_fixed') {
    return {
      works_dow: params.weeklyWeekdays,
      offs_dow: [],
      weekend_rotation: 'none',
    }
  }

  if (params.patternType === 'repeating_cycle') {
    return {
      works_dow: [0, 1, 2, 3, 4, 5, 6],
      offs_dow: [],
      weekend_rotation: 'none',
    }
  }

  return {
    works_dow: [],
    offs_dow: [],
    weekend_rotation: 'none',
  }
}

function weekdaySummary(weekdays: number[]): string {
  return weekdays.map((day) => WEEKDAY_LABELS[day] ?? String(day)).join(', ')
}

function getRepeatingCyclePosition(pattern: WorkPattern, date: string): WorkPatternCycleSegment | null {
  if (pattern.pattern_type !== 'repeating_cycle' || !pattern.cycle_anchor_date) return null
  if (pattern.cycle_segments.length === 0) return null

  const anchorDate = parseDate(pattern.cycle_anchor_date)
  const targetDate = parseDate(date)
  if (!anchorDate || !targetDate) return null

  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.floor((targetDate.getTime() - anchorDate.getTime()) / dayMs)
  if (diffDays < 0) return null

  const cycleLength = pattern.cycle_segments.reduce((total, segment) => total + segment.length_days, 0)
  if (cycleLength < 1) return null

  let remaining = diffDays % cycleLength
  for (const segment of pattern.cycle_segments) {
    if (remaining < segment.length_days) {
      return segment
    }
    remaining -= segment.length_days
  }

  return pattern.cycle_segments[pattern.cycle_segments.length - 1] ?? null
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
  const patternType = normalizePatternType(raw)
  const worksDowMode = raw.works_dow_mode === 'soft' ? 'soft' : 'hard'
  const weekendRule = normalizeWeekendRule(raw.weekend_rule, raw.weekend_rotation)
  const weeklyWeekdays = normalizeDowValues(raw.weekly_weekdays ?? raw.works_dow)
  const cycleSegments = normalizeCycleSegments(raw.cycle_segments)
  const legacyWeeklyMirror = buildLegacyWeeklyMirror({
    patternType,
    weeklyWeekdays,
    weekendRule,
  })

  return {
    therapist_id: raw.therapist_id,
    pattern_type: patternType,
    works_dow:
      patternType === 'none'
        ? []
        : normalizeDowValues(raw.works_dow ?? legacyWeeklyMirror.works_dow),
    offs_dow:
      patternType === 'weekly_fixed'
        ? normalizeDowValues(raw.offs_dow)
        : legacyWeeklyMirror.offs_dow,
    weekend_rotation: legacyWeeklyMirror.weekend_rotation,
    weekend_anchor_date: raw.weekend_anchor_date ?? null,
    works_dow_mode: worksDowMode,
    shift_preference:
      raw.shift_preference === 'day' || raw.shift_preference === 'night' || raw.shift_preference === 'either'
        ? raw.shift_preference
        : 'either',
    weekly_weekdays: patternType === 'none' || patternType === 'repeating_cycle' ? [] : weeklyWeekdays,
    weekend_rule: patternType === 'weekly_with_weekend_rotation' ? weekendRule : 'none',
    cycle_anchor_date: patternType === 'repeating_cycle' ? raw.cycle_anchor_date ?? null : null,
    cycle_segments: patternType === 'repeating_cycle' ? cycleSegments : [],
  }
}

export function describeWorkPatternSummary(pattern: WorkPattern | null): string {
  if (!pattern || pattern.pattern_type === 'none') return 'No recurring pattern saved.'

  if (pattern.pattern_type === 'repeating_cycle') {
    const cycleLength = pattern.cycle_segments.reduce((total, segment) => total + segment.length_days, 0)
    if (!pattern.cycle_anchor_date || cycleLength < 1) return 'Repeating cycle is incomplete.'
    return `Repeats every ${cycleLength} days starting ${formatLongDate(pattern.cycle_anchor_date)}.`
  }

  const weekdayText =
    pattern.weekly_weekdays.length > 0 ? weekdaySummary(pattern.weekly_weekdays) : 'no weekdays'
  let summary = `Works ${weekdayText}.`

  if (pattern.pattern_type === 'weekly_with_weekend_rotation') {
    if (pattern.weekend_rule === 'every_weekend') {
      summary += ' Every weekend.'
    } else if (pattern.weekend_rule === 'every_other_weekend' && pattern.weekend_anchor_date) {
      summary += ` Every other weekend starting ${formatLongDate(pattern.weekend_anchor_date)}.`
    } else {
      summary += ' No weekends.'
    }
  }

  return summary
}

export function isWeekendOn(pattern: WorkPattern, date: string): boolean {
  const weekendSaturday = getWeekendSaturday(date)
  if (!weekendSaturday) return true

  if (pattern.pattern_type !== 'weekly_with_weekend_rotation') {
    return true
  }

  if (pattern.weekend_rule === 'every_weekend') return true
  if (pattern.weekend_rule !== 'every_other_weekend') return false

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
  if (pattern.pattern_type === 'none') {
    return { allowed: true, reason: 'allowed', penalty: 0 }
  }

  if (pattern.pattern_type === 'repeating_cycle') {
    const segment = getRepeatingCyclePosition(pattern, date)
    if (!segment) return { allowed: true, reason: 'allowed', penalty: 0 }
    if (segment.kind === 'off') {
      return { allowed: false, reason: 'blocked_repeating_cycle_off_segment', penalty: 0 }
    }
    return { allowed: true, reason: 'allowed', penalty: 0 }
  }

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
    pattern.pattern_type === 'weekly_with_weekend_rotation' &&
    pattern.weekend_rule !== 'none' &&
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

export function shiftTypeMatches(
  overrideShiftType: ShiftTypeForAvailability,
  shiftType: ShiftTypeForAvailability
): boolean {
  return overrideShiftType === 'both' || overrideShiftType === shiftType
}
