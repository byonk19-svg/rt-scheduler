import { describe, expect, it } from 'vitest'

import {
  classifyOverrideOutcome,
  countViolatedForceOnOverrides,
  findMatchingOverride,
} from '@/lib/availability-override-model'
import type { AvailabilityOverrideRow } from '@/lib/coverage/types'

function override(row: Partial<AvailabilityOverrideRow> = {}): AvailabilityOverrideRow {
  return {
    therapist_id: 'therapist-1',
    cycle_id: 'cycle-1',
    date: '2026-04-07',
    shift_type: 'both',
    override_type: 'force_off',
    source: 'therapist',
    ...row,
  }
}

describe('availability override model', () => {
  it('finds the highest priority matching override for a shift slot', () => {
    const match = findMatchingOverride({
      overrides: [
        override({ shift_type: 'both', override_type: 'force_on', source: 'therapist' }),
        override({ shift_type: 'day', override_type: 'force_off', source: 'manager' }),
      ],
      therapistId: 'therapist-1',
      cycleId: 'cycle-1',
      date: '2026-04-07',
      shiftType: 'day',
    })

    expect(match?.override_type).toBe('force_off')
    expect(match?.source).toBe('manager')
  })

  it('classifies Need Off scheduled on a matching shift as violated', () => {
    expect(
      classifyOverrideOutcome({
        override: override({ override_type: 'force_off', shift_type: 'both' }),
        scheduledShifts: [{ date: '2026-04-07', shift_type: 'night', status: 'scheduled' }],
      })
    ).toEqual({ kind: 'violated', reason: 'force_off_scheduled' })
  })

  it('counts only explicit Need to Work overrides that are not honored by active schedule rows', () => {
    expect(
      countViolatedForceOnOverrides({
        overrides: [
          override({ therapist_id: 'therapist-1', override_type: 'force_on', source: 'manager' }),
          override({ therapist_id: 'therapist-2', override_type: 'force_on', source: 'therapist' }),
          override({ therapist_id: 'legacy', override_type: 'force_on', source: undefined }),
        ],
        scheduledShifts: [
          {
            user_id: 'therapist-2',
            date: '2026-04-07',
            shift_type: 'day',
            status: 'scheduled',
          },
        ],
      })
    ).toBe(1)
  })
})
