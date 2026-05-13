import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = () =>
  readFileSync(resolve(process.cwd(), 'src/components/schedule-grid/ScheduleGrid.tsx'), 'utf8')

describe('ScheduleGrid source invariants', () => {
  it('binds structural mutations to the loaded dataset shift', () => {
    const code = source()

    expect(code).toContain('shiftType: initialDataset.shiftType')
    expect(code).not.toContain('shiftType: shiftTabToQueryValue(shiftTab)')
  })

  it('locks cell interactions while a shift or cycle navigation is pending', () => {
    const code = source()

    expect(code).toContain('const cellsLocked = isPending || isShiftNavigating')
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
})
