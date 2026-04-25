import { describe, expect, it } from 'vitest'

import { buildCoverageRiskAlert } from '@/lib/coverage/proactive-risk'

describe('buildCoverageRiskAlert', () => {
  it('returns the strongest staffing-risk slot with supporting context', () => {
    const alert = buildCoverageRiskAlert({
      unfilledConstraintSlots: [
        { date: '2026-04-09', shiftType: 'day', missingCount: 1 },
        { date: '2026-04-10', shiftType: 'night', missingCount: 2 },
      ],
      missingLeadSlots: 1,
      forcedMustWorkMisses: 2,
    })

    expect(alert).not.toBeNull()
    expect(alert?.strongestDate).toBe('2026-04-10')
    expect(alert?.strongestShiftType).toBe('night')
    expect(alert?.strongestMissingCount).toBe(2)
    expect(alert?.atRiskSlotCount).toBe(2)
    expect(alert?.tone).toBe('critical')
    expect(alert?.description).toContain('3-person minimum')
    expect(alert?.description).toContain('availability overrides and coverage targets')
    expect(alert?.notice).toContain('Coverage risk before Auto-draft')
  })

  it('returns null when no minimum-staffing shortfall is predicted', () => {
    expect(
      buildCoverageRiskAlert({
        unfilledConstraintSlots: [],
        missingLeadSlots: 2,
        forcedMustWorkMisses: 1,
      })
    ).toBeNull()
  })
})
