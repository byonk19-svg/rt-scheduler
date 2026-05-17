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
  })

  it('shows daily totals', () => {
    const html = renderTable(makeDataset())

    expect(html).toContain('data-testid="total-2026-05-04"')
    expect(html).toContain('>1</span>')
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
    expect(html).toContain('sticky right-0')
  })

  it('uses compact column widths so all 6 weeks can fit on desktop', () => {
    const html = renderTable(makeDataset())

    expect(html).toContain('min-w-[118px]')
    expect(html).toContain('min-w-5')
    expect(html).toContain('min-w-8')
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
  })
})
