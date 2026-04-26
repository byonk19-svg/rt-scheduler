import { addDays, toIsoDate } from '@/lib/calendar-utils'
import {
  isAllowedByPattern,
  type PatternDecisionReason,
  type WorkPattern,
} from '@/lib/coverage/work-patterns'

export type GeneratedAvailabilityBaselineDay = {
  baselineStatus: 'available' | 'off'
  baselineSource: 'recurring_pattern' | 'none'
  reason: PatternDecisionReason | 'none'
}

export function buildCycleAvailabilityBaseline(params: {
  cycleStart: string
  cycleEnd: string
  pattern: WorkPattern | null
}): Record<string, GeneratedAvailabilityBaselineDay> {
  const startDate = new Date(`${params.cycleStart}T00:00:00`)
  const endDate = new Date(`${params.cycleEnd}T00:00:00`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    return {}
  }

  const dayCount = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1

  const baseline: Record<string, GeneratedAvailabilityBaselineDay> = {}
  for (let index = 0; index < dayCount; index += 1) {
    const date = toIsoDate(addDays(startDate, index))
    if (!params.pattern || params.pattern.pattern_type === 'none') {
      baseline[date] = {
        baselineStatus: 'off',
        baselineSource: 'none',
        reason: 'none',
      }
      continue
    }

    const decision = isAllowedByPattern(params.pattern, date)
    baseline[date] = {
      baselineStatus: decision.allowed ? 'available' : 'off',
      baselineSource: 'recurring_pattern',
      reason: decision.reason,
    }
  }

  return baseline
}
