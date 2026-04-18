import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/availability/ManagerSchedulingInputs.tsx'),
  'utf8'
)

describe('ManagerSchedulingInputs performance contract', () => {
  it('lazy-loads the heaviest planner sub-surfaces instead of statically importing them all', () => {
    expect(source).not.toContain(
      "import { AvailabilityCalendarPanel } from '@/components/availability/availability-calendar-panel'"
    )
    expect(source).not.toContain(
      "import { AvailabilitySecondaryPanel } from '@/components/availability/availability-secondary-panel'"
    )
    expect(source).not.toContain(
      "import { PlannerControlRail } from '@/components/availability/planner-control-rail'"
    )
    expect(source).not.toContain(
      "import { TherapistContextPanel } from '@/components/availability/therapist-context-panel'"
    )
    expect(source).toContain('const AvailabilityCalendarPanel = dynamic(() =>')
    expect(source).toContain('const AvailabilitySecondaryPanel = dynamic(() =>')
    expect(source).toContain('const PlannerControlRail = dynamic(() =>')
    expect(source).toContain('const TherapistContextPanel = dynamic(() =>')
  })
})
