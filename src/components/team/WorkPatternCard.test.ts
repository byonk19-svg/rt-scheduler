import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { WorkPatternCard } from '@/components/team/WorkPatternCard'

describe('WorkPatternCard', () => {
  it('renders weekday chips plus mode and weekend badges', () => {
    const html = renderToStaticMarkup(
      createElement(WorkPatternCard, {
        worksDow: [1, 3, 5],
        offsDow: [0, 6],
        weekendRotation: 'every_other',
        worksDowMode: 'hard',
      })
    )

    expect(html).toContain('Su')
    expect(html).toContain('Mo')
    expect(html).toContain('Sa')
    expect(html).toContain('Every other weekend')
    expect(html).toContain('Hard')
    expect(html).toContain('Hard = must work these days. Soft = preferred but flexible.')
  })
})
