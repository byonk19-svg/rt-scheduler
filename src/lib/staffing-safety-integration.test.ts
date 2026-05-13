import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('staffing safety integration guardrails', () => {
  it('keeps coverage grid and drawer wired to the shared coverage health model', () => {
    const grid = readSource('src/components/coverage/CalendarGrid.tsx')
    const drawer = readSource('src/components/coverage/ShiftEditorDialog.tsx')

    expect(grid).toContain('getCoverageHealth')
    expect(grid).not.toContain('activeCount < MIN_SHIFT_COVERAGE_PER_DAY')
    expect(drawer).toContain('getCoverageHealth')
    expect(drawer).not.toContain('Math.max(4 - activeCount')
  })

  it('keeps Shift Board and Lottery using shared active-working semantics', () => {
    const shiftBoard = readSource('src/lib/shift-board-snapshot.ts')
    const lotteryService = readSource('src/lib/lottery/service.ts')

    expect(shiftBoard).toContain('evaluateStaffingSafety')
    expect(shiftBoard).toContain('countsAsActiveWorkingStatus')
    expect(shiftBoard).not.toContain('function countsTowardCoverage')
    expect(lotteryService).toContain('countsAsActiveWorkingStatus')
    expect(lotteryService).not.toContain("assignment.liveStatus === 'scheduled'")
  })
})
