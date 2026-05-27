import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = () =>
  readFileSync(resolve(process.cwd(), 'src/components/schedule-grid/ScheduleGrid.tsx'), 'utf8')
const toolbarSource = () =>
  readFileSync(
    resolve(process.cwd(), 'src/components/schedule-grid/ScheduleGridToolbar.tsx'),
    'utf8'
  )

describe('ScheduleGrid source invariants', () => {
  it('binds structural mutations to the loaded dataset shift', () => {
    const code = source()

    expect(code).toContain('shiftType: initialDataset.shiftType')
    expect(code).not.toContain('shiftType: shiftTabToQueryValue(shiftTab)')
  })

  it('locks cell interactions while a route or mutation transition is pending', () => {
    const code = source()

    expect(code).toContain('const cellsLocked = isPending')
    expect(code).toContain('startTransition(() => {')
    expect(code).toContain('router.replace(`${pathname}?${params.toString()}`, { scroll: false })')
    expect(code).toContain('if (cellsLocked) return')
    expect(code).toContain('interactionsDisabled={cellsLocked}')
  })

  it('allows manager assignment on published schedule cells through the unified grid', () => {
    const code = source()
    const handleAssignBlock = code.slice(
      code.indexOf('const handleAssign = useCallback'),
      code.indexOf('const handleUnassign = useCallback')
    )

    expect(handleAssignBlock).toContain('interactionMode.canAssignShifts')
    expect(handleAssignBlock).not.toContain('!initialDataset.isPublished')
  })

  it('gates schedule interactions through the explicit interaction mode', () => {
    const code = source()
    const toolbarCode = toolbarSource()

    expect(code).toContain('const interactionMode = initialDataset.interactionMode')
    expect(code).toContain('interactionMode.canAssignShifts')
    expect(code).toContain('interactionMode.canUnassignShifts')
    expect(code).toContain('interactionMode.canDesignateLead')
    expect(code).toContain('interactionMode.canUpdateAssignmentStatus')
    expect(toolbarCode).toContain('interactionMode.canUseManagerToolbar')
  })

  it('uses explicit shift labels in the toolbar', () => {
    const code = toolbarSource()

    expect(code).toContain('{tab} shift')
    expect(code).toContain('Schedule Block')
  })

  it('maps each interaction mode to a concise visible grid hint', () => {
    const code = source()

    expect(code).toContain('function getScheduleInteractionHint')
    expect(code).toContain("case 'manager_edit'")
    expect(code).toContain('Select actionable cells to edit coverage or update shift status.')
    expect(code).toContain("case 'lead_status'")
    expect(code).toContain(
      'Select assigned published shifts to update live status. Off cells are read-only.'
    )
    expect(code).toContain("case 'combined_readonly'")
    expect(code).toContain('Read-only combined schedule view.')
    expect(code).toContain("case 'staff_view'")
    expect(code).toContain('Read-only team schedule. Your row is highlighted for quick reference.')
  })

  it('renders the interaction hint in the compact legend strip', () => {
    const code = source()

    expect(code).toContain('const interactionHint = getScheduleInteractionHint(interactionMode)')
    expect(code).toContain('aria-label="Schedule legend"')
    expect(code).toContain('{interactionHint}')
    expect(code).toContain('border-l border-border/60')
  })

  it('adds a compact paper-style title inside the schedule grid', () => {
    const code = source()

    expect(code).toContain('Respiratory Therapy')
    expect(code).toContain('cycleDateRangeLabel')
    expect(code).toContain('{sheetTitle}')
  })

  it('uses non-blocking feedback for schedule mutation failures', () => {
    const code = source()

    expect(code).toContain('FeedbackToast')
    expect(code).not.toContain('window.alert')
    expect(code).toContain('Could not assign this shift. Refresh Schedule and try again.')
    expect(code).toContain('Could not remove this assignment. Refresh Schedule and try again.')
    expect(code).toContain('Could not update this shift status. Refresh Schedule and try again.')
    expect(code).toContain('Could not set the lead for this shift. Refresh Schedule and try again.')
  })
})
