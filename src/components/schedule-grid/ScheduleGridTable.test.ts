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
    cycleDates: ['2026-05-03', '2026-05-04', '2026-05-05'],
    cycleDateRangeLabel: 'May 3 - May 5, 2026',
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
          '2026-05-03': {
            shiftId: null,
            status: 'off',
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
    dailyTotals: { '2026-05-03': 0, '2026-05-04': 1, '2026-05-05': 0 },
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
    expect(html).toContain('border-yellow-300')
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
    expect(html).toContain('Your row')
  })

  it('keeps the viewer row first when staff view the team schedule', () => {
    const html = renderTable(
      makeDataset({
        viewerUserId: 'u2',
        viewerRole: 'therapist',
        canManageCoverage: false,
        canUpdateAssignmentStatus: false,
        therapistRows: [
          {
            userId: 'u1',
            name: 'Alice Johnson',
            isOnFmla: false,
            isActive: true,
            employmentType: 'full_time',
            shiftType: 'day',
            cells: {},
          },
          {
            userId: 'u2',
            name: 'Bailey Smith',
            isOnFmla: false,
            isActive: true,
            employmentType: 'full_time',
            shiftType: 'day',
            cells: {
              '2026-05-04': {
                shiftId: 's2',
                status: 'staff',
                hasNeedsOff: false,
                isIneligible: false,
              },
            },
          },
        ],
      })
    )

    expect(html.indexOf('You (Bailey Smith)')).toBeGreaterThanOrEqual(0)
    expect(html.indexOf('You (Bailey Smith)')).toBeLessThan(html.indexOf('Alice Johnson'))
    expect(html).toContain('Your row')
  })

  it('adds a subtle scan treatment to the viewer row without changing status colors', () => {
    const html = renderTable(
      makeDataset({
        viewerUserId: 'u1',
        viewerRole: 'therapist',
        canManageCoverage: false,
        canUpdateAssignmentStatus: false,
      })
    )
    const assignedCell = getCellButton(html, 'u1', '2026-05-04')
    const offCell = getCellButton(html, 'u1', '2026-05-03')

    expect(html).toContain('border-teal-700')
    expect(assignedCell).toContain('ring-teal-700/30')
    expect(assignedCell).toContain('bg-yellow-200')
    expect(offCell).not.toContain('ring-teal-700/30')
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

  it('keeps date headers and totals sticky for scanning the 42-day grid', () => {
    const html = renderTable(makeDataset())

    expect(html).toContain('sticky left-0 top-0')
    expect(html).toContain('sticky top-0')
    expect(html).toContain('sticky bottom-0')
    expect(html).not.toContain('sticky right-0')
  })

  it('uses compact column widths so all 6 weeks can fit on desktop', () => {
    const html = renderTable(makeDataset())

    expect(html).toContain('min-w-[118px]')
    expect(html).toContain('min-w-5')
    expect(html).not.toContain('>Total</th>')
  })

  it('marks Sunday week boundaries without changing date order', () => {
    const html = renderTable(makeDataset())

    expect(html).toContain('border-l-2 border-l-foreground/35')
    expect(html.indexOf('>S</span>')).toBeLessThan(html.indexOf('>M</span>'))
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
    expect(html).toContain('Your row')
  })
})
