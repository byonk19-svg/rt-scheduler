import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvailabilityStatusSummary } from '@/components/availability/AvailabilityStatusSummary'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/availability/AvailabilityStatusSummary.tsx'),
  'utf8'
)
const listSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/AvailabilityStatusSummaryList.tsx'),
  'utf8'
)

describe('AvailabilityStatusSummary', () => {
  it('renders a compact response roster with dense filters and submission metadata', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityStatusSummary, {
        submittedRows: [
          {
            therapistId: 'submitted-1',
            therapistName: 'Adrienne S.',
            overridesCount: 2,
            lastUpdatedAt: '2026-03-15T12:00:00.000Z',
          },
          {
            therapistId: 'submitted-2',
            therapistName: 'Barbara C.',
            overridesCount: 1,
            lastUpdatedAt: '2026-03-14T12:00:00.000Z',
          },
          {
            therapistId: 'submitted-3',
            therapistName: 'Kim S.',
            overridesCount: 3,
            lastUpdatedAt: '2026-03-13T12:00:00.000Z',
          },
          {
            therapistId: 'submitted-4',
            therapistName: 'Rosa V.',
            overridesCount: 1,
            lastUpdatedAt: '2026-03-12T12:00:00.000Z',
          },
        ],
        missingRows: [
          {
            therapistId: 'missing-1',
            therapistName: 'Layne P.',
            overridesCount: 0,
            lastUpdatedAt: null,
          },
          {
            therapistId: 'missing-2',
            therapistName: 'Tannie L.',
            overridesCount: 0,
            lastUpdatedAt: null,
          },
        ],
        initialFilter: 'all',
      })
    )

    expect(html).toContain('Response roster')
    expect(html).toContain('All')
    expect(html).toContain('Not submitted')
    expect(html).toContain('Submitted')
    expect(html).toContain('Has requests')
    expect(html).toContain('Last activity')
    expect(html).toContain('Adrienne S.')
    expect(html).toContain('Barbara C.')
    expect(html).toContain('divide-y')
    expect(html).not.toContain('shadow-tw-sm')
    expect(html).not.toContain('data-slot="card"')
  })

  it('renders the list container with a max-height class so it scrolls internally', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityStatusSummary, {
        submittedRows: Array.from({ length: 30 }, (_, i) => ({
          therapistId: `t-${i}`,
          therapistName: `Therapist ${i}`,
          overridesCount: 1,
          lastUpdatedAt: '2026-03-01T12:00:00.000Z',
        })),
        missingRows: [],
      })
    )

    expect(html).toContain('max-h-[420px]')
    expect(html).not.toMatch(/flex-1.*overflow-y-auto|overflow-y-auto.*flex-1/)
  })

  it('keeps roster row rendering in a dedicated summary list component', () => {
    expect(source).toContain('AvailabilityStatusSummaryList')
    expect(listSource).toContain('No therapists match the current roster filter.')
    expect(listSource).toContain('Last activity')
  })
})
