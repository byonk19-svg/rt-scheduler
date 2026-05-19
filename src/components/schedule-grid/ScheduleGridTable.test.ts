import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleGridTable } from './ScheduleGridTable'
import type { GridDataset } from './schedule-grid-types'

function makeDataset(overrides: Partial<GridDataset> = {}): GridDataset {
  return {
    cycleId: 'c1',
    shiftType: 'day',
    availableCycles: [{ id: 'c1', label: 'May 4 - May 5, 2026' }],
    cycleDates: ['2026-05-04', '2026-05-05'],
    cycleDateRangeLabel: 'May 4 - May 5, 2026',
    isPublished: false,
    therapistRows: [
      {
        userId: 'u1',
        name: 'Alice Johnson',
        isOnFmla: false,
        isActive: true,
        employmentType: 'full_time',
        shiftType: 'day',
        cells: {
          '2026-05-04': {
            shiftId: 's1',
            status: 'lead',
            hasNeedsOff: false,
            isIneligible: false,
          },
          '2026-05-05': {
            shiftId: null,
            status: 'off',
            hasNeedsOff: true,
            isIneligible: false,
          },
        },
      },
    ],
    dailyTotals: { '2026-05-04': 1, '2026-05-05': 0 },
    viewerUserId: 'mgr1',
    viewerRole: 'manager',
    canManageCoverage: true,
    canUpdateAssignmentStatus: true,
    ...overrides,
  }
}

function renderTable(dataset: GridDataset, interactionsDisabled = false) {
  return renderToStaticMarkup(
    createElement(ScheduleGridTable, { dataset, onCellClick: vi.fn(), interactionsDisabled })
  )
}

function getCellButton(html: string, userId: string, date: string) {
  return html.match(new RegExp(`<button[^>]*data-testid="cell-${userId}-${date}"[^>]*>`))?.[0] ?? ''
}

describe('ScheduleGridTable', () => {
  it('renders therapist names', () => {
    expect(renderTable(makeDataset())).toContain('Alice Johnson')
  })

  it('renders lead cells with yellow styling', () => {
    const html = renderTable(makeDataset())

    expect(html).toContain('data-testid="cell-u1-2026-05-04"')
    expect(html).toContain('bg-yellow-200')
    expect(html).toContain('1')
  })

  it('renders a needs-off asterisk', () => {
    expect(renderTable(makeDataset())).toContain('data-testid="asterisk-u1-2026-05-05"')
  })

  it('pins the viewer row for staff viewers', () => {
    const html = renderTable(
      makeDataset({
        viewerUserId: 'u1',
        viewerRole: 'therapist',
        canManageCoverage: false,
        canUpdateAssignmentStatus: false,
      })
    )

    expect(html).toContain('You (Alice Johnson)')
  })

  it('shows daily totals', () => {
    const html = renderTable(makeDataset())

    expect(html).toContain('data-testid="total-2026-05-04"')
    expect(html).toContain('>1</span>')
  })

  it('does not render a per-therapist total column', () => {
    const html = renderTable(makeDataset())

    expect(html).not.toContain('>Total</th>')
    expect(html).toContain('Daily total')
  })

  it('keeps PRN therapists in a bottom section below regular staff', () => {
    const html = renderTable(
      makeDataset({
        therapistRows: [
          {
            userId: 'regular-1',
            name: 'Regular Therapist',
            isOnFmla: false,
            isActive: true,
            employmentType: 'full_time',
            shiftType: 'day',
            cells: {
              '2026-05-04': {
                shiftId: 'regular-shift',
                status: 'staff',
                hasNeedsOff: false,
                isIneligible: false,
              },
              '2026-05-05': {
                shiftId: null,
                status: 'off',
                hasNeedsOff: false,
                isIneligible: false,
              },
            },
          },
          {
            userId: 'prn-1',
            name: 'PRN Therapist',
            isOnFmla: false,
            isActive: true,
            employmentType: 'prn',
            shiftType: 'day',
            cells: {
              '2026-05-04': {
                shiftId: null,
                status: 'off',
                hasNeedsOff: false,
                isIneligible: false,
              },
              '2026-05-05': {
                shiftId: 'prn-shift',
                status: 'staff',
                hasNeedsOff: false,
                isIneligible: false,
              },
            },
          },
        ],
        dailyTotals: { '2026-05-04': 1, '2026-05-05': 1 },
      })
    )

    expect(html).toContain('Daily staffing')
    expect(html).not.toContain('PRN staff')
    expect(html.indexOf('Regular Therapist')).toBeLessThan(html.indexOf('Daily staffing'))
    expect(html.indexOf('Daily staffing')).toBeLessThan(html.indexOf('PRN Therapist'))
    expect(html).toContain('data-testid="regular-total-2026-05-04"')
    expect(html).toContain('data-testid="total-2026-05-05"')
  })

  it('explains an empty shift roster with a next step', () => {
    const html = renderTable(
      makeDataset({
        therapistRows: [],
        dailyTotals: {},
      })
    )

    expect(html).toContain('No day-shift therapists found for this Schedule Block.')
    expect(html).toContain('Switch shifts or check Team roster settings')
    expect(html).not.toContain('<table')
  })

  it('lets managers assign empty cells on published schedules', () => {
    const html = renderTable(makeDataset({ isPublished: true }))
    const cell = getCellButton(html, 'u1', '2026-05-05')

    expect(cell).toContain('data-testid="cell-u1-2026-05-05"')
    expect(cell).not.toContain('disabled')
  })

  it('locks cell interactions while schedule navigation is pending', () => {
    const html = renderTable(makeDataset({ isPublished: true }), true)
    const cell = getCellButton(html, 'u1', '2026-05-04')

    expect(cell).toContain('data-testid="cell-u1-2026-05-04"')
    expect(cell).toContain('disabled=""')
  })

  it('keeps therapists read-only', () => {
    const html = renderTable(
      makeDataset({
        viewerUserId: 'u1',
        viewerRole: 'therapist',
        canManageCoverage: false,
        canUpdateAssignmentStatus: false,
        isPublished: true,
      })
    )
    const cell = getCellButton(html, 'u1', '2026-05-04')

    expect(cell).toContain('data-testid="cell-u1-2026-05-04"')
    expect(cell).toContain('disabled=""')
  })
})
