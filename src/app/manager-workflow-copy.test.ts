import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const coverageSource = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/coverage/coverage-workspace-state.ts'),
  'utf8'
)
const approvalsSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/approvals/page.tsx'),
  'utf8'
)
const publishSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/publish/page.tsx'),
  'utf8'
)
const finalizeHeaderSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/manager/FinalizeScheduleHeader.tsx'),
  'utf8'
)
const availabilitySource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/availability/page.tsx'),
  'utf8'
)

describe('manager workflow page framing', () => {
  it('frames Coverage as the execution workspace inside the schedule workflow', () => {
    expect(coverageSource).toContain(
      'Execution workspace for staffing, lead coverage, and publish readiness.'
    )
  })

  it('frames Approvals as part of the current schedule workflow', () => {
    expect(approvalsSource).toContain(
      'Review live claims and schedule change requests as part of the current schedule workflow.'
    )
  })

  it('frames Publish as a finalization flow and separates delivery history', () => {
    expect(finalizeHeaderSource).toContain('Move draft blocks toward publish')
    expect(publishSource).toContain('FinalizeScheduleHeader')
  })

  it('frames Availability as a staffing input for the active schedule workflow', () => {
    expect(availabilitySource).toContain('Availability planning')
    expect(availabilitySource).toContain(
      'Use therapist responses and manager inputs to shape staffing before coverage is finalized.'
    )
  })
})
