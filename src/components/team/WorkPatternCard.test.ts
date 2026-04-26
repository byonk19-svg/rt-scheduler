import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { WorkPatternCard } from '@/components/team/WorkPatternCard'

describe('WorkPatternCard', () => {
  it('renders weekday chips plus a plain-English recurring pattern summary', () => {
    const html = renderToStaticMarkup(
      createElement(WorkPatternCard, {
        pattern: {
          therapist_id: 'therapist-1',
          pattern_type: 'weekly_with_weekend_rotation',
          works_dow: [1, 3, 5],
          offs_dow: [0, 6],
          weekly_weekdays: [1, 3, 5],
          weekend_rule: 'every_other_weekend',
          weekend_rotation: 'every_other',
          weekend_anchor_date: '2026-05-03',
          works_dow_mode: 'hard',
          cycle_anchor_date: null,
          cycle_segments: [],
          shift_preference: 'either',
        },
      })
    )

    expect(html).toContain('Su')
    expect(html).toContain('Mo')
    expect(html).toContain('Sa')
    expect(html).toContain('Works Mon, Wed, Fri. Every other weekend starting May 3, 2026.')
    expect(html).toContain('Fixed work days')
  })
})
