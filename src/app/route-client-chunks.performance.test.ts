import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const coverageClientSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/coverage/CoverageClientPage.tsx'),
  'utf8'
)
const coverageOverlaysSource = readFileSync(
  resolve(process.cwd(), 'src/components/coverage/CoverageWorkspaceOverlays.tsx'),
  'utf8'
)
const availabilityPageSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'),
  'utf8'
)
const shiftBoardPageSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/shift-board/page.tsx'),
  'utf8'
)

describe('coverage client performance contract', () => {
  it('keeps heavy dialog and print surfaces lazy-loaded behind the overlay boundary', () => {
    expect(coverageClientSource).toContain('CoverageWorkspaceOverlays')
    expect(coverageOverlaysSource).toContain('const PreFlightDialog = dynamic(() =>')
    expect(coverageOverlaysSource).toContain('const PrintSchedule = dynamic(() =>')
  })

  it('keeps the main coverage client focused on workspace composition instead of route-local dynamic imports', () => {
    expect(coverageClientSource).not.toContain('const PrintSchedule = dynamic(() =>')
    expect(coverageClientSource).not.toContain('const PreFlightDialog = dynamic(() =>')
  })
})

describe('availability route performance contract', () => {
  it('imports the main availability workspaces directly to avoid fragile next/dynamic default resolution on the server page', () => {
    expect(availabilityPageSource).toContain('import { AvailabilityEntriesTable')
    expect(availabilityPageSource).toContain(
      "import { ManagerSchedulingInputs } from '@/components/availability/ManagerSchedulingInputs'"
    )
    expect(availabilityPageSource).not.toContain(
      "import {\n  EmailIntakePanel,\n  type EmailIntakePanelRow,\n} from '@/components/availability/EmailIntakePanel'"
    )
    expect(availabilityPageSource).not.toContain('const AvailabilityEntriesTable = dynamic(() =>')
    expect(availabilityPageSource).not.toContain('const ManagerSchedulingInputs = dynamic(() =>')
    expect(availabilityPageSource).not.toContain('const EmailIntakePanel = dynamic(() =>')
    expect(availabilityPageSource).toContain('redirect(`/therapist/availability')
    expect(availabilityPageSource).toContain('redirect(`/availability/intake')
  })
})

describe('shift-board route performance contract', () => {
  it('keeps the route page server-rendered and delegates the interactive UI to a client component', () => {
    expect(shiftBoardPageSource).not.toContain("'use client'")
    expect(shiftBoardPageSource).toContain('import ShiftBoardClientPage')
    expect(shiftBoardPageSource).toContain('loadShiftBoardSnapshot')
  })
})
