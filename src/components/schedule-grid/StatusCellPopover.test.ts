import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  PopoverAnchor: () => null,
  PopoverContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-testid': 'popover-content' }, children),
}))

import { StatusCellPopover } from './StatusCellPopover'
import type { GridCell } from './schedule-grid-types'

const assignedCell: GridCell = {
  shiftId: 'shift-1',
  status: 'staff',
  hasNeedsOff: false,
  isIneligible: false,
}

function renderPopover({
  allowStatusChange,
  canUnassign,
  canDesignateLead,
}: {
  allowStatusChange: boolean
  canUnassign: boolean
  canDesignateLead: boolean
}) {
  return renderToStaticMarkup(
    createElement(StatusCellPopover, {
      open: true,
      onOpenChange: vi.fn(),
      anchorEl: null,
      therapistName: 'Alice Johnson',
      date: '2026-05-04',
      cell: assignedCell,
      allowStatusChange,
      canUnassign,
      canDesignateLead,
      isCurrentlyLead: false,
      onStatusChange: vi.fn(),
      onUnassign: vi.fn(),
      onDesignateLead: vi.fn(),
      isPending: false,
    })
  )
}

describe('StatusCellPopover', () => {
  it('shows lead status options without structural controls', () => {
    const html = renderPopover({
      allowStatusChange: true,
      canUnassign: false,
      canDesignateLead: false,
    })

    expect(html).toContain('On call')
    expect(html).toContain('Cancelled')
    expect(html).not.toContain('Unassign')
    expect(html).not.toContain('Designate as lead')
  })

  it('shows manager structural controls and status options', () => {
    const html = renderPopover({
      allowStatusChange: true,
      canUnassign: true,
      canDesignateLead: true,
    })

    expect(html).toContain('On call')
    expect(html).toContain('Designate as lead')
    expect(html).toContain('Unassign')
  })

  it('does not render therapist mutation controls', () => {
    const html = renderPopover({
      allowStatusChange: false,
      canUnassign: false,
      canDesignateLead: false,
    })

    expect(html).not.toContain('On call')
    expect(html).not.toContain('Cancelled')
    expect(html).not.toContain('Unassign')
    expect(html).not.toContain('Designate as lead')
  })
})
