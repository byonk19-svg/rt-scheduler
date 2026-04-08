import { describe, expect, it } from 'vitest'

import type { AvailabilityOverrideRow, Therapist } from '@/app/schedule/types'

import { generateDraftForCycle } from '@/lib/coverage/generate-draft'

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
})
