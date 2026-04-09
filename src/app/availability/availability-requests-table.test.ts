import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

const THERAPIST_REVIEW_ROWS: AvailabilityEntryTableRow[] = [
  {
    id: 'a',
    cycleId: 'cycle-1',
    date: '2026-03-24',
    reason: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    requestedBy: 'Jamie T.',
    cycleLabel: 'Mar 22-May 2',
    entryType: 'force_off',
    shiftType: 'both',
    canDelete: true,
  },
  {
    id: 'b',
    cycleId: 'cycle-1',
    date: '2026-03-25',
    reason: 'Prefer this day',
    createdAt: '2026-03-01T11:00:00.000Z',
    requestedBy: 'Jamie T.',
    cycleLabel: 'Mar 22-May 2',
    entryType: 'force_on',
    shiftType: 'both',
    canDelete: true,
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

  it('uses a quiet empty note and a clear View affordance for therapist review', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityEntriesTable, {
        role: 'therapist',
        rows: THERAPIST_REVIEW_ROWS,
        deleteAvailabilityEntryAction: async () => {},
        titleOverride: 'Submitted Availability',
        initialFilters: {},
      })
    )

    expect(html).not.toContain('No reason provided')
    expect(html).toContain('—')
    expect(html).toContain('>View</button>')
    expect(html).not.toContain('Details</span>')
    expect(html).toMatch(/>2<\/span>\s*entries/)
    expect(html).toContain('>Action</th>')
    expect(html).toContain('1 Need Off')
    expect(html).toContain('1 Request to Work')
    expect(html).not.toContain('>Shift</th>')
  })

  it('keeps a Shift column when any row differentiates shift scope', () => {
    const rows: AvailabilityEntryTableRow[] = [
      ...THERAPIST_REVIEW_ROWS,
      {
        id: 'c',
        cycleId: 'cycle-1',
        date: '2026-03-26',
        reason: null,
        createdAt: '2026-03-02T10:00:00.000Z',
        requestedBy: 'Jamie T.',
        cycleLabel: 'Mar 22-May 2',
        entryType: 'force_off',
        shiftType: 'day',
        canDelete: true,
      },
    ]
    const html = renderToStaticMarkup(
      createElement(AvailabilityEntriesTable, {
        role: 'therapist',
        rows,
        deleteAvailabilityEntryAction: async () => {},
        initialFilters: {},
      })
    )

    expect(html).toContain('>Shift</th>')
    expect(html).toContain('Day shift')
  })

  it('uses Entry saved + last activity timestamp in expanded row detail (source)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/app/availability/availability-requests-table.tsx'),
      'utf8'
    )
    expect(src).toContain('Entry saved')
    expect(src).toContain('formatDateTime(row.updatedAt ?? row.createdAt)')
    expect(src).not.toMatch(
      />[\s\n]*Submitted[\s\n]*<\/p>[\s\n]*<p className="text-sm text-foreground">[\s\n]*\{formatDateTime\(row\.createdAt\)\}/
    )
  })
})
