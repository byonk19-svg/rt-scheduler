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

    expect(handleAssignBlock).toContain(
      'if (!activeCellTarget || !initialDataset.canManageCoverage || cellsLocked) return'
    )
    expect(handleAssignBlock).not.toContain('!initialDataset.isPublished')
  })

  it('uses explicit shift labels in the toolbar', () => {
    const code = toolbarSource()

    expect(code).toContain('{tab} shift')
    expect(code).toContain('Schedule Block')
  })

  it('adds a compact paper-style title inside the schedule grid', () => {
    const code = source()

    expect(code).toContain('Respiratory Therapy')
    expect(code).toContain('cycleDateRangeLabel')
    expect(code).toContain('{gridTitle}')
  })
})
