import { describe, expect, it } from 'vitest'

import type { GenerateDraftResult } from '@/lib/coverage/generate-draft'
import { generateDraftForCycle } from '@/lib/coverage/generate-draft'
import { runPreFlight, summarizePreFlight } from '@/lib/coverage/pre-flight'

const BASE_INPUT = {
  cycleId: 'cycle-1',
  cycleStartDate: '2026-04-07',
  cycleEndDate: '2026-04-07',
  therapists: [],
  existingShifts: [],
  allAvailabilityOverrides: [],
  weeklyShifts: [],
}

describe('coverage pre-flight', () => {
  it('reuses the pure draft generator', () => {
    expect(runPreFlight(BASE_INPUT)).toEqual(generateDraftForCycle(BASE_INPUT))
  })

  it('summarizes unfilled, missing-lead, and forced-miss counts', () => {
    const result: GenerateDraftResult = {
      draftShiftsToInsert: [],
      pendingLeadUpdates: [],
      unfilledConstraintSlots: [
        { date: '2026-04-07', shiftType: 'day', missingCount: 2 },
        { date: '2026-04-08', shiftType: 'night', missingCount: 1 },
      ],
      unfilledSlots: 3,
      constraintsUnfilledSlots: 3,
      missingLeadSlots: 2,
      forcedMustWorkMisses: 1,
    }

    expect(summarizePreFlight(result)).toEqual({
      unfilledSlots: 2,
      missingLeadSlots: 2,
      forcedMustWorkMisses: 1,
      details: [
        { date: '2026-04-07', shiftType: 'day', missingCount: 2 },
        { date: '2026-04-08', shiftType: 'night', missingCount: 1 },
      ],
    })
  })
})
