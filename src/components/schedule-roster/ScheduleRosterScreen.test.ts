import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { getTableSizing } from '@/components/schedule-roster/PaperScheduleGrid'
import { ScheduleRosterScreen } from '@/components/schedule-roster/ScheduleRosterScreen'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}))

describe('ScheduleRosterScreen', () => {
  it('renders the paper schedule shell with live cycle metadata, working read-only actions, and legend copy', () => {
    const html = renderToStaticMarkup(
      createElement(ScheduleRosterScreen, {
        live: {
          cycleId: 'cycle-1',
          label: 'Cycle Alpha',
          startDate: '2026-05-03',
          endDate: '2026-05-09',
          shortLabel: 'May 3 - May 9, 2026',
          isPublished: false,
          defaultShiftType: 'day',
          availableCycles: [
            { id: 'cycle-1', label: 'Cycle Alpha' },
            { id: 'cycle-2', label: 'Cycle Beta' },
          ],
          staff: [],
          assignments: {},
          availabilityApprovals: {},
        },
      })
    )

    expect(html).toContain('Roster View - Day Shift')
    expect(html).toContain('Cycle Alpha')
    expect(html).toContain('May 3 - May 9, 2026')
    expect(html).not.toContain('March 22, 2026')
    expect(html).toContain('DRAFT')
    expect(html).toContain('Print')
    expect(html).toContain('Open Coverage')
    expect(html).not.toContain('Export')
    expect(html).not.toContain('Publish')
    expect(html).toContain('PRN / Extra staff')
    expect(html).toContain('Staffing Count')
    expect(html).toContain('On Call')
    expect(html).toContain('Call In')
    expect(html).toContain('Roster view only')
    expect(html).toContain(
      'Use Coverage to edit staffing, auto-draft, or publish this Schedule Block.'
    )
    expect(html).toContain('Bold vertical lines separate weeks')
    expect(html).toContain('Weekends shaded')
    expect(html).toContain('<colgroup>')
    expect(html).not.toContain('Open Shifts')
    expect(html).not.toContain('Pending Requests')
    expect(html).not.toContain('Coverage Warnings')
    expect(html).not.toContain('Schedule Summary')
    expect(html).not.toContain('Go to Date')
  })

  it('keeps the schedule matrix adaptive: measured container, fixed therapist rail, and scroll fallback', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/schedule-roster/PaperScheduleGrid.tsx'),
      'utf8'
    )

    expect(source).toContain('ResizeObserver')
    expect(source).toContain('table-fixed')
    expect(source).toContain('<colgroup>')
    expect(source).toContain('const THERAPIST_COLUMN_WIDTH = 200')
    expect(source).toContain('const MIN_DAY_COLUMN_WIDTH = 26')
    expect(source).toContain('const IDEAL_DAY_COLUMN_WIDTH = 28')
    expect(source).toContain('const MAX_DAY_COLUMN_WIDTH = 28')
    expect(source).toContain(
      'export function getTableSizing(containerWidth: number, totalDays: number)'
    )
    expect(source).toContain("overflowX: tableWidth > containerWidth ? 'auto' : 'hidden'")
    expect(source).toContain('ref={scrollerRef}')
    expect(source).toContain('style={{ overflowX }}')
    expect(source).toContain('rowSpan={2}')
    expect(source).toContain('style={{ width: THERAPIST_COLUMN_WIDTH }}')
    expect(source).toContain('style={{ width: dayColumnWidth }}')
    expect(source).toContain('style={{ width: tableWidth }}')
    expect(source).toContain('style={{ top: WEEK_HEADER_HEIGHT }}')
    expect(source).toContain('sticky left-0')
    expect(source).toContain('sticky top-0')
    expect(source).toContain('border-l-2')
    expect(source).not.toContain('const TABLE_WIDTH =')
  })

  it('fits six weeks on wide desktop containers and falls back to scroll on narrow ones', () => {
    expect(getTableSizing(1516, 42)).toEqual({
      dayColumnWidth: 28,
      overflowX: 'hidden',
      tableWidth: 1376,
    })

    expect(getTableSizing(1200, 42)).toEqual({
      dayColumnWidth: 26,
      overflowX: 'auto',
      tableWidth: 1292,
    })
  })
})
