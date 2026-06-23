import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleGridToolbar } from './ScheduleGridToolbar'
import type { ScheduleInteractionMode } from './schedule-grid-types'

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

function renderToolbar(interactionMode: ScheduleInteractionMode) {
  return renderToStaticMarkup(
    createElement(ScheduleGridToolbar, {
      cycleId: 'cycle-1',
      cycleDateRangeLabel: 'May 3 - Jun 13, 2026',
      availableCycles: [{ id: 'cycle-1', label: 'May 3 - Jun 13, 2026' }],
      isPublished: false,
      cycleStatus: 'draft',
      shiftTab: 'Day',
      isPending: false,
      interactionMode,
      onCycleChange: vi.fn(),
      onShiftTabChange: vi.fn(),
      onPrint: vi.fn(),
      templateOptions: [
        { id: 'template-1', name: 'Standard staffing', shiftCount: 12, dayCount: 6 },
      ],
      templateAction: vi.fn(),
    })
  )
}

describe('ScheduleGridToolbar template controls', () => {
  it('exposes template save and apply controls to managers', () => {
    const html = renderToolbar(MANAGER_EDIT_MODE)

    expect(html).toContain('Templates')
    expect(html).toContain('Template name')
    expect(html).toContain('Save as template')
    expect(html).toContain('Saved template')
    expect(html).toContain('Standard staffing')
    expect(html).toContain('Apply template')
  })

  it('hides template controls from staff viewers', () => {
    const html = renderToolbar(STAFF_VIEW_MODE)

    expect(html).not.toContain('Save as template')
    expect(html).not.toContain('Apply template')
  })
})
