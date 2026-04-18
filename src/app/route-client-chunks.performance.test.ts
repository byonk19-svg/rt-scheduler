import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const coverageClientSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/coverage/CoverageClientPage.tsx'),
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
  it('lazy-loads the heavy coverage views instead of statically importing both', () => {
    expect(coverageClientSource).not.toContain(
      "import { CalendarGrid } from '@/components/coverage/CalendarGrid'"
    )
    expect(coverageClientSource).not.toContain(
      "import { RosterScheduleView, type RosterMemberRow } from '@/components/coverage/RosterScheduleView'"
    )
    expect(coverageClientSource).toContain('const CalendarGrid = dynamic(() =>')
    expect(coverageClientSource).toContain('const RosterScheduleView = dynamic(() =>')
  })

  it('lazy-loads the print surface instead of bundling it eagerly with the main coverage client chunk', () => {
    expect(coverageClientSource).not.toContain(
      "import { PrintSchedule } from '@/components/print-schedule'"
    )
    expect(coverageClientSource).toContain('const PrintSchedule = dynamic(() =>')
  })
})

describe('availability route performance contract', () => {
  it('lazy-loads the major availability client workspaces instead of statically bundling them together', () => {
    expect(availabilityPageSource).not.toContain(
      "import {\n  AvailabilityEntriesTable,\n  type AvailabilityEntryTableRow,\n} from '@/app/availability/availability-requests-table'"
    )
    expect(availabilityPageSource).not.toContain(
      "import { ManagerSchedulingInputs } from '@/components/availability/ManagerSchedulingInputs'"
    )
    expect(availabilityPageSource).not.toContain(
      "import {\n  EmailIntakePanel,\n  type EmailIntakePanelRow,\n} from '@/components/availability/EmailIntakePanel'"
    )
    expect(availabilityPageSource).toContain('const AvailabilityEntriesTable = dynamic(() =>')
    expect(availabilityPageSource).toContain('const ManagerSchedulingInputs = dynamic(() =>')
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
