import { describe, expect, it } from 'vitest'

import type { AvailabilityOverrideRow, Therapist } from '@/app/schedule/types'

import { generateDraftForCycle } from '@/lib/coverage/generate-draft'
import { weeklyCountKey } from '@/lib/schedule-helpers'
import { summarizePublishWeeklyViolations } from '@/lib/schedule-rule-validation'

const BASE_INPUT = {
  cycleId: 'cycle-1',
  cycleStartDate: '2026-04-07',
  cycleEndDate: '2026-04-07',
  therapists: [] as Therapist[],
  existingShifts: [],
  allAvailabilityOverrides: [] as AvailabilityOverrideRow[],
  weeklyShifts: [],
}

describe('generateDraftForCycle', () => {
  it('returns empty result when there are no therapists', () => {
    const result = generateDraftForCycle(BASE_INPUT)
    expect(result.draftShiftsToInsert).toHaveLength(0)
    expect(result.unfilledSlots).toBeGreaterThan(0)
    expect(result.missingLeadSlots).toBeGreaterThan(0)
    expect(result.forcedMustWorkMisses).toBe(0)
  })

  it('assigns a day lead for a day-shift lead therapist; night slot still missing a lead', () => {
    const therapist: Therapist = {
      id: 't1',
      full_name: 'Jane Doe',
      shift_type: 'day',
      is_lead_eligible: true,
      employment_type: 'full_time',
      max_work_days_per_week: 5,
      works_dow: [0, 1, 2, 3, 4, 5, 6],
      offs_dow: [],
      weekend_rotation: 'none',
      weekend_anchor_date: null,
      works_dow_mode: 'hard',
      shift_preference: 'day',
      on_fmla: false,
      fmla_return_date: null,
      is_active: true,
    }
    const result = generateDraftForCycle({
      ...BASE_INPUT,
      therapists: [therapist],
    })
    expect(result.draftShiftsToInsert.some((s) => s.shift_type === 'day' && s.role === 'lead')).toBe(
      true
    )
    expect(result.missingLeadSlots).toBe(1)
  })

  it('counts forced-on override as a miss when therapist is not scheduled', () => {
    const override: AvailabilityOverrideRow = {
      therapist_id: 'nobody',
      cycle_id: 'cycle-1',
      date: '2026-04-07',
      shift_type: 'day',
      override_type: 'force_on',
      source: 'manager',
    }
    const result = generateDraftForCycle({
      ...BASE_INPUT,
      allAvailabilityOverrides: [override],
    })
    expect(result.forcedMustWorkMisses).toBe(1)
  })

  it('respects repeating-cycle off segments through therapist.pattern', () => {
    const therapist: Therapist = {
      id: 't2',
      full_name: 'Cycle Therapist',
      shift_type: 'day',
      is_lead_eligible: false,
      employment_type: 'full_time',
      max_work_days_per_week: 5,
      works_dow: [0, 1, 2, 3, 4, 5, 6],
      offs_dow: [],
      weekend_rotation: 'none',
      weekend_anchor_date: null,
      works_dow_mode: 'hard',
      pattern: {
        therapist_id: 't2',
        pattern_type: 'repeating_cycle',
        works_dow: [0, 1, 2, 3, 4, 5, 6],
        offs_dow: [],
        weekend_rotation: 'none',
        weekend_anchor_date: null,
        works_dow_mode: 'hard',
        weekly_weekdays: [],
        weekend_rule: 'none',
        cycle_anchor_date: '2026-04-06',
        cycle_segments: [
          { kind: 'work', length_days: 1 },
          { kind: 'off', length_days: 2 },
        ],
        shift_preference: 'day',
      },
      shift_preference: 'day',
      on_fmla: false,
      fmla_return_date: null,
      is_active: true,
    }

    const result = generateDraftForCycle({
      ...BASE_INPUT,
      therapists: [therapist],
    })

    expect(result.draftShiftsToInsert.some((shift) => shift.user_id === therapist.id)).toBe(false)
  })

  it('auto-drafts standing PRN weekend patterns without requiring one-off availability rows', () => {
    const therapist: Therapist = {
      id: 'prn-weekend',
      full_name: 'Weekend PRN',
      shift_type: 'day',
      is_lead_eligible: false,
      employment_type: 'prn',
      max_work_days_per_week: 2,
      works_dow: [0, 6],
      offs_dow: [],
      weekend_rotation: 'none',
      weekend_anchor_date: null,
      works_dow_mode: 'hard',
      pattern: {
        therapist_id: 'prn-weekend',
        pattern_type: 'weekly_with_weekend_rotation',
        works_dow: [0, 6],
        offs_dow: [],
        weekend_rotation: 'none',
        weekend_anchor_date: null,
        works_dow_mode: 'hard',
        weekly_weekdays: [],
        weekend_rule: 'every_weekend',
        cycle_anchor_date: null,
        cycle_segments: [],
        shift_preference: 'day',
      },
      shift_preference: 'day',
      on_fmla: false,
      fmla_return_date: null,
      is_active: true,
    }

    const result = generateDraftForCycle({
      ...BASE_INPUT,
      cycleStartDate: '2026-04-11',
      cycleEndDate: '2026-04-11',
      therapists: [therapist],
    })

    expect(result.draftShiftsToInsert).toContainEqual(
      expect.objectContaining({
        user_id: 'prn-weekend',
        date: '2026-04-11',
        shift_type: 'day',
      })
    )
  })

  it('creates a draft that does not fail publish weekly validation just because roster capacity is larger than demand', () => {
    const makeTherapist = (
      id: string,
      shiftType: 'day' | 'night',
      isLeadEligible = false
    ): Therapist => ({
      id,
      full_name: id,
      shift_type: shiftType,
      is_lead_eligible: isLeadEligible,
      employment_type: 'full_time',
      max_work_days_per_week: 3,
      works_dow: [0, 1, 2, 3, 4, 5, 6],
      offs_dow: [],
      weekend_rotation: 'none',
      weekend_anchor_date: null,
      works_dow_mode: 'hard',
      shift_preference: shiftType,
      on_fmla: false,
      fmla_return_date: null,
      is_active: true,
    })

    const therapists = [
      ...Array.from({ length: 32 }, (_, index) =>
        makeTherapist(`day-${index + 1}`, 'day', index < 3)
      ),
      ...Array.from({ length: 32 }, (_, index) =>
        makeTherapist(`night-${index + 1}`, 'night', index < 3)
      ),
    ]
    const result = generateDraftForCycle({
      ...BASE_INPUT,
      cycleStartDate: '2026-05-31',
      cycleEndDate: '2026-06-06',
      therapists,
    })

    expect(result.unfilledSlots).toBe(0)
    expect(result.missingLeadSlots).toBe(0)

    const scheduledTherapistIds = new Set(result.draftShiftsToInsert.map((shift) => shift.user_id))
    expect(scheduledTherapistIds.size).toBeLessThan(therapists.length)

    const weeklyWorkedDatesByUserWeek = new Map<string, Set<string>>()
    for (const shift of result.draftShiftsToInsert) {
      const key = weeklyCountKey(shift.user_id, '2026-05-31')
      const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
      workedDates.add(shift.date)
      weeklyWorkedDatesByUserWeek.set(key, workedDates)
    }

    expect(
      summarizePublishWeeklyViolations({
        therapistIds: therapists.map((therapist) => therapist.id),
        cycleWeekDates: new Map([
          [
            '2026-05-31',
            new Set([
              '2026-05-31',
              '2026-06-01',
              '2026-06-02',
              '2026-06-03',
              '2026-06-04',
              '2026-06-05',
              '2026-06-06',
            ]),
          ],
        ]),
        weeklyWorkedDatesByUserWeek,
        maxWorkDaysByTherapist: new Map(therapists.map((therapist) => [therapist.id, 3])),
        minWorkDaysByTherapist: new Map(),
      })
    ).toEqual({
      underCount: 0,
      overCount: 0,
      violations: 0,
    })
  })
})
