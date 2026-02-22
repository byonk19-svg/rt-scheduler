import { describe, expect, it } from 'vitest'

import { weeklyCountKey } from '@/lib/schedule-helpers'
import {
  exceedsCoverageLimit,
  exceedsWeeklyLimit,
  summarizeCoverageViolations,
  summarizePublishWeeklyViolations,
} from '@/lib/schedule-rule-validation'

describe('schedule rule validation', () => {
  it('flags coverage at max as exceeding limit', () => {
    expect(exceedsCoverageLimit(5, 5)).toBe(true)
    expect(exceedsCoverageLimit(4, 5)).toBe(false)
  })

  it('flags weekly limit only when target date is new', () => {
    const workedDates = new Set(['2026-03-01', '2026-03-02', '2026-03-03'])

    expect(exceedsWeeklyLimit(workedDates, '2026-03-04', 3)).toBe(true)
    expect(exceedsWeeklyLimit(workedDates, '2026-03-03', 3)).toBe(false)
  })

  it('summarizes publish weekly violations including partial week requirement', () => {
    const cycleWeekDates = new Map<string, Set<string>>([
      [
        '2026-03-01',
        new Set([
          '2026-03-01',
          '2026-03-02',
          '2026-03-03',
          '2026-03-04',
          '2026-03-05',
          '2026-03-06',
          '2026-03-07',
        ]),
      ],
      ['2026-03-08', new Set(['2026-03-08', '2026-03-09'])],
    ])

    const weeklyWorkedDatesByUserWeek = new Map<string, Set<string>>([
      [weeklyCountKey('t1', '2026-03-01'), new Set(['2026-03-01', '2026-03-02', '2026-03-03'])],
      [weeklyCountKey('t1', '2026-03-08'), new Set(['2026-03-08'])],
      [
        weeklyCountKey('t2', '2026-03-01'),
        new Set(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04']),
      ],
      [weeklyCountKey('t2', '2026-03-08'), new Set(['2026-03-08', '2026-03-09'])],
    ])

    const result = summarizePublishWeeklyViolations({
      therapistIds: ['t1', 't2'],
      cycleWeekDates,
      weeklyWorkedDatesByUserWeek,
      maxWorkDaysPerWeek: 3,
    })

    expect(result).toEqual({
      underCount: 1,
      overCount: 1,
      violations: 2,
    })
  })

  it('summarizes coverage violations across day/night slots', () => {
    const coverageBySlot = new Map<string, number>([
      ['2026-03-01:day', 2],
      ['2026-03-01:night', 3],
      ['2026-03-02:day', 6],
      ['2026-03-02:night', 4],
    ])

    const result = summarizeCoverageViolations({
      cycleDates: ['2026-03-01', '2026-03-02'],
      coverageBySlot,
      minCoveragePerShift: 3,
      maxCoveragePerShift: 5,
    })

    expect(result).toEqual({
      underCoverage: 1,
      overCoverage: 1,
      violations: 2,
    })
  })
})
