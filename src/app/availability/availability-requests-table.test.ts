import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  AvailabilityEntriesTable,
  type AvailabilityEntryTableRow,
} from '@/app/availability/availability-requests-table'

const MANAGER_ROWS: AvailabilityEntryTableRow[] = [
  {
    id: 'entry-1',
    cycleId: 'cycle-1',
    date: '2026-03-24',
    reason: 'Vacation',
    createdAt: '2026-03-01T10:00:00.000Z',
    requestedBy: 'Adrienne S.',
    cycleLabel: 'Mar 22-May 2',
    entryType: 'force_off',
    shiftType: 'both',
    canDelete: false,
  },
]

describe('AvailabilityEntriesTable', () => {
  it('frames manager review as request review work', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityEntriesTable, {
        role: 'manager',
        rows: MANAGER_ROWS,
        deleteAvailabilityEntryAction: async () => {},
        initialFilters: {},
      })
    )

    expect(html).toContain('Review requests')
    expect(html).toContain('Scan submitted requests before the cycle is published.')
  })
})
