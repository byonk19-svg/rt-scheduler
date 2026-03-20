import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvailabilityStatusSummary } from '@/components/availability/AvailabilityStatusSummary'

describe('AvailabilityStatusSummary', () => {
  it('emphasizes missing responses first and collapses the submitted roster by default', () => {
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

    expect(html.indexOf('Not submitted yet')).toBeLessThan(html.indexOf('Submitted'))
    expect(html).toContain('2 therapists still need to respond')
    expect(html).toContain('Show all 4 submitted therapists')
    expect(html).not.toContain('<details open')
    expect(html).not.toContain('data-slot="card"')
  })
})
