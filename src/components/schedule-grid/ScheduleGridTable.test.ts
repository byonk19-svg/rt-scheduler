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
