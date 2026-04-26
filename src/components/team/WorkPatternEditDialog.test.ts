import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { validateWeekendAnchorDate } from '@/components/team/WorkPatternEditDialog'
import { WorkPatternEditDialog } from '@/components/team/WorkPatternEditDialog'

describe('validateWeekendAnchorDate', () => {
  it('accepts Saturdays and rejects other days', () => {
    expect(validateWeekendAnchorDate('2026-04-18')).toBeNull()
    expect(validateWeekendAnchorDate('2026-04-17')).toBe('Weekend anchor date must be a Saturday.')
  })

  it('disables the quick editor for repeating-cycle patterns', () => {
    const html = renderToStaticMarkup(
      createElement(WorkPatternEditDialog, {
        therapistId: 'therapist-1',
        therapistName: 'Cycle Therapist',
        initialPattern: {
          pattern_type: 'repeating_cycle',
          works_dow: [0, 1, 2, 3, 4, 5, 6],
          offs_dow: [],
          works_dow_mode: 'hard',
          weekend_rotation: 'none',
          weekend_anchor_date: null,
          cycle_anchor_date: '2026-05-01',
          cycle_segments: [
            { kind: 'work', length_days: 4 },
            { kind: 'off', length_days: 3 },
          ],
        },
        saveWorkPatternAction: async () => {},
      })
    )

    expect(html).toContain('Advanced pattern')
    expect(html).toContain('disabled=""')
  })
})
