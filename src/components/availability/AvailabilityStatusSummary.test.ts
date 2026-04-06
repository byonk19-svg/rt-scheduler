import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvailabilityStatusSummary } from '@/components/availability/AvailabilityStatusSummary'

describe('AvailabilityStatusSummary', () => {
  it('renders a response roster with not-submitted rows first and a submitted tab', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityStatusSummary, {
        submittedRows: [
          { therapistId: 'submitted-1', therapistName: 'Adrienne S.', overridesCount: 2 },
          { therapistId: 'submitted-2', therapistName: 'Barbara C.', overridesCount: 1 },
          { therapistId: 'submitted-3', therapistName: 'Kim S.', overridesCount: 3 },
          { therapistId: 'submitted-4', therapistName: 'Rosa V.', overridesCount: 1 },
        ],
        missingRows: [
          { therapistId: 'missing-1', therapistName: 'Layne P.' },
          { therapistId: 'missing-2', therapistName: 'Tannie L.' },
        ],
      })
    )

    expect(html).toContain('Response roster')
    expect(html.indexOf('Not submitted yet')).toBeLessThan(html.indexOf('Submitted'))
    expect(html).toContain('2 therapists still need to respond')
    expect(html).toContain('Adrienne S.')
    expect(html).toContain('Barbara C.')
    expect(html).not.toContain('data-slot="card"')
  })

  it('renders the list container with a max-height class so it scrolls internally', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityStatusSummary, {
        submittedRows: Array.from({ length: 30 }, (_, i) => ({
          therapistId: `t-${i}`,
          therapistName: `Therapist ${i}`,
          overridesCount: 1,
        })),
        missingRows: [],
      })
    )

    expect(html).toContain('max-h-[560px]')
    expect(html).not.toMatch(/flex-1.*overflow-y-auto|overflow-y-auto.*flex-1/)
  })
})
