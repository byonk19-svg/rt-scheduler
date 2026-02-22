import { describe, expect, it } from 'vitest'

import { getScheduleFeedback } from '@/lib/schedule-helpers'

describe('schedule feedback messaging', () => {
  it('summarizes publish blocking with lead and coverage issue counts', () => {
    const feedback = getScheduleFeedback({
      error: 'publish_shift_rule_violation',
      under_coverage: '2',
      over_coverage: '1',
      lead_missing: '3',
      lead_multiple: '1',
      lead_ineligible: '1',
      affected: '2026-03-22 day, 2026-03-22 night',
    })

    expect(feedback?.variant).toBe('error')
    expect(feedback?.message).toContain('Coverage under: 2')
    expect(feedback?.message).toContain('coverage over: 1')
    expect(feedback?.message).toContain('missing lead: 3')
    expect(feedback?.message).toContain('Affected: 2026-03-22 day, 2026-03-22 night')
  })
})
