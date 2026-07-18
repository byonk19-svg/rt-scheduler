import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleGridTable } from './ScheduleGridTable'
import type { GridCell, GridDataset, ScheduleInteractionMode } from './schedule-grid-types'

const MANAGER_EDIT_MODE: ScheduleInteractionMode = {
  kind: 'manager_edit',
  canUseManagerToolbar: true,
  canAssignShifts: true,
  canUnassignShifts: true,
  canDesignateLead: true,
  canUpdateAssignmentStatus: true,
}

const STAFF_VIEW_MODE: ScheduleInteractionMode = {
  kind: 'staff_view',
  canUseManagerToolbar: false,
  canAssignShifts: false,
  canUnassignShifts: false,
  canDesignateLead: false,
  canUpdateAssignmentStatus: false,
}

const LEAD_STATUS_MODE: ScheduleInteractionMode = {
  kind: 'lead_status',
  canUseManagerToolbar: false,
  canAssignShifts: false,
  canUnassignShifts: false,
  canDesignateLead: false,
  canUpdateAssignmentStatus: true,
}

const COMBINED_READONLY_MODE: ScheduleInteractionMode = {
  kind: 'combined_readonly',
  canUseManagerToolbar: false,
  canAssignShifts: false,
  canUnassignShifts: false,
  canDesignateLead: false,
  canUpdateAssignmentStatus: false,
}

function makeDataset(overrides: Partial<GridDataset> = {}): GridDataset {
  return {
    cycleId: 'c1',
    shiftType: 'day',
    interactionMode: MANAGER_EDIT_MODE,
    availableCycles: [{ id: 'c1', label: 'May 4 - May 5, 2026' }],
    templateOptions: [],
    cycleDates: ['2026-05-03', '2026-05-04', '2026-05-05'],
    cycleDateRangeLabel: 'May 3 - May 5, 2026',
    isPublished: false,
    cycleStatus: 'draft',
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
    createElement(ScheduleGridTable, {
      dataset,
      interactionMode: dataset.interactionMode,
      onCellClick: vi.fn(),
      interactionsDisabled,
    })
  )
}

function getCellButton(html: string, userId: string, date: string) {
  return (
    html.match(
      new RegExp(`<button[^>]*data-testid="cell-${userId}-${date}"[^>]*>[\\s\\S]*?</button>`)
    )?.[0] ?? ''
  )
}

function makeDatasetWithAliceCell(
  date: string,
  cell: GridCell,
  overrides: Partial<GridDataset> = {}
): GridDataset {
  const base = makeDataset()

  return makeDataset({
    ...overrides,
    therapistRows: [
      {
        ...base.therapistRows[0],
        cells: {
          ...base.therapistRows[0].cells,
          [date]: cell,
        },
      },
    ],
  })
}

describe('ScheduleGridTable', () => {
  it('renders therapist names', () => {
    expect(renderTable(makeDataset())).toContain('Alice Johnson')
  })

  it('renders lead cells with yellow styling', () => {
    const html = renderTable(makeDataset())
    const cell = getCellButton(html, 'u1', '2026-05-04')

    expect(html).toContain('data-testid="cell-u1-2026-05-04"')
    expect(cell).toContain('bg-yellow-200')
    expect(cell).toContain('border-yellow-300')
    expect(html).toContain('>1</span></button>')
  })

  it('renders a needs-off asterisk', () => {
    expect(renderTable(makeDataset())).toContain('data-testid="asterisk-u1-2026-05-05"')
  })

  it('labels scheduled staff cells with therapist, date, shift, status, and action context', () => {
    const html = renderTable(
      makeDatasetWithAliceCell('2026-05-04', {
        shiftId: 's1',
        status: 'staff',
        hasNeedsOff: false,
        isIneligible: false,
      })
    )
    const cell = getCellButton(html, 'u1', '2026-05-04')

    expect(cell).toContain(
      'aria-label="Alice Johnson, Mon, May 4, 2026, day shift, scheduled staff, opens schedule actions"'
    )
    expect(cell).toContain(
      'title="Alice Johnson, Mon, May 4, 2026, day shift, scheduled staff, opens schedule actions"'
    )
  })

  it('distinguishes lead cells from regular scheduled cells in the accessible name', () => {
    const html = renderTable(makeDataset())
    const cell = getCellButton(html, 'u1', '2026-05-04')

    expect(cell).toContain(
      'aria-label="Alice Johnson, Mon, May 4, 2026, day shift, lead, opens schedule actions"'
    )
    expect(cell).not.toContain('scheduled staff')
  })

  it('expands operational status codes in cell accessible names', () => {
    const cases: Array<[GridCell['status'], string]> = [
      ['on_call', 'on call'],
      ['cancelled', 'cancelled'],
      ['call_in', 'call in'],
      ['left_early', 'left early'],
    ]

    for (const [status, statusLabel] of cases) {
      const html = renderTable(
        makeDatasetWithAliceCell('2026-05-04', {
          shiftId: `shift-${status}`,
          status,
          hasNeedsOff: false,
          isIneligible: false,
        })
      )
      const cell = getCellButton(html, 'u1', '2026-05-04')

      expect(cell).toContain(`day shift, ${statusLabel}, opens schedule actions`)
    }
  })

  it('announces Need Off context for asterisk cells', () => {
    const html = renderTable(makeDataset())
    const cell = getCellButton(html, 'u1', '2026-05-05')

    expect(cell).toContain(
      'aria-label="Alice Johnson, Tue, May 5, 2026, day shift, not scheduled, Need Off, opens schedule actions"'
    )
    expect(html).toContain('data-testid="asterisk-u1-2026-05-05"')
  })

  it('explains inactive and FMLA assignment blocks in disabled cell labels', () => {
    const html = renderTable(
      makeDataset({
        therapistRows: [
          {
            userId: 'inactive-1',
            name: 'Inactive Therapist',
            isOnFmla: false,
            isActive: false,
            employmentType: 'full_time',
            shiftType: 'day',
            cells: {
              '2026-05-04': {
                shiftId: null,
                status: 'off',
                hasNeedsOff: false,
                isIneligible: true,
                ineligibleReason: 'inactive',
              },
            },
          },
          {
            userId: 'fmla-1',
            name: 'FMLA Therapist',
            isOnFmla: true,
            isActive: true,
            employmentType: 'full_time',
            shiftType: 'day',
            cells: {
              '2026-05-04': {
                shiftId: null,
                status: 'off',
                hasNeedsOff: false,
                isIneligible: true,
                ineligibleReason: 'fmla',
              },
            },
          },
        ],
        dailyTotals: { '2026-05-03': 0, '2026-05-04': 0, '2026-05-05': 0 },
      })
    )

    expect(html).toContain('Inactive')
    expect(html).toContain('FMLA')
    expect(getCellButton(html, 'inactive-1', '2026-05-04')).toContain(
      'not eligible: inactive team member'
    )
    expect(getCellButton(html, 'fmla-1', '2026-05-04')).toContain('not eligible: FMLA')
  })

  it('hides inactive and FMLA rationale from staff schedule views', () => {
    const html = renderTable(
      makeDataset({
        viewerUserId: 'viewer-1',
        viewerRole: 'therapist',
        interactionMode: STAFF_VIEW_MODE,
        canManageCoverage: false,
        canUpdateAssignmentStatus: false,
        isPublished: true,
        therapistRows: [
          {
            userId: 'viewer-1',
            name: 'Alice Johnson',
            isOnFmla: false,
            isActive: true,
            employmentType: 'full_time',
            shiftType: 'day',
            cells: {
              '2026-05-04': {
                shiftId: 'shift-viewer',
                status: 'staff',
                hasNeedsOff: false,
                isIneligible: false,
              },
            },
          },
          {
            userId: 'inactive-1',
            name: 'Casey Nguyen',
            isOnFmla: false,
            isActive: false,
            employmentType: 'full_time',
            shiftType: 'day',
            cells: {
              '2026-05-04': {
                shiftId: null,
                status: 'off',
                hasNeedsOff: false,
                isIneligible: true,
                ineligibleReason: 'inactive',
              },
            },
          },
          {
            userId: 'fmla-1',
            name: 'Blair Morgan',
            isOnFmla: true,
            isActive: true,
            employmentType: 'full_time',
            shiftType: 'day',
            cells: {
              '2026-05-04': {
                shiftId: null,
                status: 'off',
                hasNeedsOff: false,
                isIneligible: true,
                ineligibleReason: 'fmla',
              },
            },
          },
        ],
        dailyTotals: { '2026-05-03': 0, '2026-05-04': 1, '2026-05-05': 0 },
      })
    )

    expect(html).not.toContain('FMLA')
    expect(html).not.toContain('Inactive')
    expect(getCellButton(html, 'inactive-1', '2026-05-04')).toContain(
      'not scheduled, not eligible, read-only'
    )
    expect(getCellButton(html, 'fmla-1', '2026-05-04')).toContain(
      'not scheduled, not eligible, read-only'
    )
    expect(getCellButton(html, 'inactive-1', '2026-05-04')).not.toContain('inactive team member')
    expect(getCellButton(html, 'fmla-1', '2026-05-04')).not.toContain('not eligible: FMLA')
  })

  it('labels non-actionable cells as read-only', () => {
    const html = renderTable(
      makeDataset({
        viewerUserId: 'u1',
        viewerRole: 'therapist',
        interactionMode: STAFF_VIEW_MODE,
        canManageCoverage: false,
        canUpdateAssignmentStatus: false,
        isPublished: true,
      })
    )
    const cell = getCellButton(html, 'u1', '2026-05-04')

    expect(cell).toContain(
      'aria-label="Alice Johnson, Mon, May 4, 2026, day shift, lead, read-only"'
    )
    expect(cell).toContain('disabled=""')
  })

  it('keeps lead status cells actionable only when existing lead permissions allow it', () => {
    const html = renderTable(
      makeDataset({
        viewerUserId: 'lead-1',
        viewerRole: 'lead',
        interactionMode: LEAD_STATUS_MODE,
        canManageCoverage: false,
        canUpdateAssignmentStatus: true,
        isPublished: true,
      })
    )
    const assignedCell = getCellButton(html, 'u1', '2026-05-04')
    const offCell = getCellButton(html, 'u1', '2026-05-05')

    expect(assignedCell).toContain('opens schedule actions')
    expect(assignedCell).not.toContain('disabled')
    expect(offCell).toContain('read-only')
    expect(offCell).toContain('disabled=""')
  })

  it('adds a subtle persistent affordance only to cells that can open actions', () => {
    const managerHtml = renderTable(makeDataset())
    const managerCell = getCellButton(managerHtml, 'u1', '2026-05-04')

    expect(managerCell).toContain('data-actionable="true"')
    expect(managerCell).toContain('aria-haspopup="dialog"')
    expect(managerCell).toContain('after:h-px')
    expect(managerCell).toContain('after:bg-[var(--print-ink-muted)]')

    const staffHtml = renderTable(
      makeDataset({
        viewerUserId: 'u1',
        viewerRole: 'therapist',
        interactionMode: STAFF_VIEW_MODE,
        canManageCoverage: false,
        canUpdateAssignmentStatus: false,
        isPublished: true,
      })
    )
    const staffCell = getCellButton(staffHtml, 'u1', '2026-05-04')

    expect(staffCell).not.toContain('data-actionable')
    expect(staffCell).not.toContain('aria-haspopup')
    expect(staffCell).not.toContain('after:h-px')
  })

  it('uses larger touch targets while preserving compact visual cell marks', () => {
    const managerHtml = renderTable(makeDataset())
    const managerCell = getCellButton(managerHtml, 'u1', '2026-05-04')

    expect(managerCell).toContain('[@media(pointer:coarse)]:min-h-11')
    expect(managerCell).toContain('[@media(pointer:coarse)]:min-w-11')
    expect(managerCell).not.toContain('-m-3.5')
    expect(managerCell).toContain('touch-manipulation')
    expect(managerCell).toContain('min-h-6')
    expect(managerCell).toContain('min-w-6')

    const staffHtml = renderTable(
      makeDataset({
        viewerUserId: 'u1',
        viewerRole: 'therapist',
        interactionMode: STAFF_VIEW_MODE,
        canManageCoverage: false,
        canUpdateAssignmentStatus: false,
        isPublished: true,
      })
    )
    const staffCell = getCellButton(staffHtml, 'u1', '2026-05-04')

    expect(staffCell).toContain('[@media(pointer:coarse)]:min-h-11')
    expect(staffCell).toContain('[@media(pointer:coarse)]:min-w-11')
    expect(staffCell).not.toContain('-m-3.5')
    expect(staffCell).toContain('touch-manipulation')
    expect(staffCell).toContain('disabled=""')
  })

  it('marks the grid wrapper and table for full-page print overrides', () => {
    const managerHtml = renderTable(makeDataset())

    expect(managerHtml).toContain('schedule-grid-print-table-wrapper')
    expect(managerHtml).toContain('schedule-grid-print-table')
  })

  it('pins the viewer row for staff viewers', () => {
    const html = renderTable(
      makeDataset({
        viewerUserId: 'u1',
        viewerRole: 'therapist',
        interactionMode: STAFF_VIEW_MODE,
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

    expect(html).toContain('border-primary/45')
    expect(html).toContain('bg-[var(--info-subtle)]')
    expect(html).not.toContain('inset_3px')
    expect(html).not.toContain('rgb(15_118_110)')
    expect(assignedCell).toContain('ring-primary/30')
    expect(assignedCell).toContain('bg-yellow-200')
    expect(offCell).not.toContain('ring-primary/30')
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
        interactionMode: STAFF_VIEW_MODE,
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

  it('lets leads update assigned published schedule cells without structural assignment', () => {
    const html = renderTable(
      makeDataset({
        viewerUserId: 'lead-1',
        viewerRole: 'lead',
        interactionMode: LEAD_STATUS_MODE,
        canManageCoverage: false,
        canUpdateAssignmentStatus: true,
        isPublished: true,
      })
    )
    const assignedCell = getCellButton(html, 'u1', '2026-05-04')
    const offCell = getCellButton(html, 'u1', '2026-05-05')

    expect(assignedCell).not.toContain('disabled')
    expect(offCell).toContain('disabled=""')
  })

  it('keeps future combined schedule views read-only for live operations', () => {
    const html = renderTable(
      makeDataset({
        interactionMode: COMBINED_READONLY_MODE,
        isPublished: true,
      })
    )
    const assignedCell = getCellButton(html, 'u1', '2026-05-04')
    const offCell = getCellButton(html, 'u1', '2026-05-05')

    expect(assignedCell).toContain('disabled=""')
    expect(offCell).toContain('disabled=""')
  })
})
