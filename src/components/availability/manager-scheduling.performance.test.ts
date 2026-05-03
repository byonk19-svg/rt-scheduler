import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/availability/ManagerSchedulingInputs.tsx'),
  'utf8'
)

describe('ManagerSchedulingInputs performance contract', () => {
  it('lazy-loads the queue, review panel, and editor dialog instead of statically importing them into the manager shell', () => {
    expect(source).not.toContain(
      "import { AvailabilityStatusSummary } from '@/components/availability/AvailabilityStatusSummary'"
    )
    expect(source).not.toContain(
      "import { TherapistContextPanel } from '@/components/availability/therapist-context-panel'"
    )
    expect(source).not.toContain(
      "import { ManagerAvailabilityEditorDialog } from '@/components/availability/manager-availability-editor-dialog'"
    )
    expect(source).toContain('const AvailabilityStatusSummary = dynamic(() =>')
    expect(source).toContain('const TherapistContextPanel = dynamic(() =>')
    expect(source).toContain('const ManagerAvailabilityEditorDialog = dynamic(() =>')
  })
})
