import { describe, expect, it } from 'vitest'

import type { AvailabilityOverrideRow, Therapist } from '@/app/schedule/types'
import { fillCoverageSlot, NO_ELIGIBLE_CANDIDATES_REASON } from '@/lib/coverage/generator-slot'

function therapist(overrides?: Partial<Therapist>): Therapist {
  return {
    id: 't-1',
    full_name: 'Therapist One',
    shift_type: 'day',
    is_lead_eligible: false,
    employment_type: 'full_time',
    max_work_days_per_week: 3,
    works_dow: [1],
    offs_dow: [],
    weekend_rotation: 'none',
    weekend_anchor_date: null,
    works_dow_mode: 'hard',
    shift_preference: 'either',
    on_fmla: false,
    fmla_return_date: null,
    is_active: true,
    ...overrides,
  }
}

describe('fillCoverageSlot', () => {
  it('fills coverage on success path', () => {
    const result = fillCoverageSlot({
      therapists: [
        therapist({ id: 't-1', works_dow: [1] }),
        therapist({ id: 't-2', works_dow: [1], full_name: 'Therapist Two' }),
      ],
      cursor: 0,
      date: '2026-03-02',
      shiftType: 'day',
      cycleId: 'cycle-1',
      availabilityOverridesByTherapist: new Map<string, AvailabilityOverrideRow[]>(),
      assignedUserIdsForDate: new Set<string>(),
      weeklyWorkedDatesByUserWeek: new Map<string, Set<string>>(),
      weeklyLimitByTherapist: new Map([
        ['t-1', 3],
        ['t-2', 3],
      ]),
      currentCoverage: 0,
      targetCoverage: 2,
      minCoverage: 1,
    })

    expect(result.pickedTherapists.map((row) => row.id)).toEqual(['t-1', 't-2'])
    expect(result.coverage).toBe(2)
    expect(result.unfilledCount).toBe(0)
    expect(result.unfilledReason).toBeNull()
  })

  it('leaves slot unfilled and records reason when only disallowed therapists exist', () => {
    const result = fillCoverageSlot({
      therapists: [
        therapist({
          id: 'blocked',
          works_dow: [2],
          works_dow_mode: 'hard',
        }),
      ],
      cursor: 0,
      date: '2026-03-02',
      shiftType: 'day',
      cycleId: 'cycle-1',
      availabilityOverridesByTherapist: new Map<string, AvailabilityOverrideRow[]>(),
      assignedUserIdsForDate: new Set<string>(),
      weeklyWorkedDatesByUserWeek: new Map<string, Set<string>>(),
      weeklyLimitByTherapist: new Map([['blocked', 3]]),
      currentCoverage: 0,
      targetCoverage: 2,
      minCoverage: 1,
    })

    expect(result.pickedTherapists).toEqual([])
    expect(result.coverage).toBe(0)
    expect(result.unfilledCount).toBe(1)
    expect(result.unfilledReason).toBe(NO_ELIGIBLE_CANDIDATES_REASON)
  })
})
