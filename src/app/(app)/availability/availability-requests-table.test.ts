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
    therapistId: 'therapist-1',
    cycleId: 'cycle-1',
    date: '2026-03-24',
    reason: 'Vacation',
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-05T08:30:00.000Z',
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
    therapistId: 'therapist-1',
    cycleId: 'cycle-1',
    date: '2026-03-24',
    reason: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    requestedBy: 'Jamie T.',
    cycleLabel: 'Mar 22-May 2',
    entryType: 'force_off',
    shiftType: 'both',
    canDelete: true,
  },
  {
    id: 'b',
    therapistId: 'therapist-1',
    cycleId: 'cycle-1',
    date: '2026-03-25',
    reason: 'Prefer this day',
    createdAt: '2026-03-01T11:00:00.000Z',
    updatedAt: '2026-03-01T11:00:00.000Z',
    requestedBy: 'Jamie T.',
    cycleLabel: 'Mar 22-May 2',
    entryType: 'force_on',
    shiftType: 'both',
    canDelete: true,
  },
]

describe('AvailabilityEntriesTable', () => {
  it('frames manager review as a compact request inbox with selected-therapist scope', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityEntriesTable, {
        role: 'manager',
        rows: MANAGER_ROWS,
        deleteAvailabilityEntryAction: async () => {},
        initialFilters: {},
        syncSearchFromPlannerFocus: true,
      })
    )

    expect(html).toContain('Request inbox')
    expect(html).toContain('Selected therapist')
    expect(html).toContain('All staff')
  })

  it('uses a compact empty state instead of a full table shell when no rows match', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityEntriesTable, {
        role: 'manager',
        rows: MANAGER_ROWS,
        deleteAvailabilityEntryAction: async () => {},
        initialFilters: { search: 'No match' },
        syncSearchFromPlannerFocus: true,
      })
    )

    expect(html).toContain('No availability requests match your filters.')
    expect(html).not.toContain('>Date</th>')
    expect(html).not.toContain('data-slot="table"')
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
    expect(html).toContain('>-</span>')
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
        therapistId: 'therapist-1',
        cycleId: 'cycle-1',
        date: '2026-03-26',
        reason: null,
        createdAt: '2026-03-02T10:00:00.000Z',
        updatedAt: '2026-03-02T10:00:00.000Z',
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
