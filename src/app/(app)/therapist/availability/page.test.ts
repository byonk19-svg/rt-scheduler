import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const pagePath = resolve(process.cwd(), 'src/app/(app)/therapist/availability/page.tsx')
const pageSource = readFileSync(pagePath, 'utf8')
const workspacePath = resolve(
  process.cwd(),
  'src/components/availability/TherapistAvailabilityWorkspace.tsx'
)
const workspaceSource = readFileSync(workspacePath, 'utf8')
const loaderPath = resolve(process.cwd(), 'src/lib/availability-page-loaders.ts')
const loaderSource = readFileSync(loaderPath, 'utf8')

describe('therapist availability route', () => {
  it('is no longer a direct re-export of the manager availability page', () => {
    expect(pageSource).not.toContain("export { default } from '../../availability/page'")
    expect(pageSource).toContain('TherapistAvailabilityWorkspace')
  })

  it('uses the therapist relationship when reading availability overrides', () => {
    expect(loaderSource).toContain('fetchAvailabilityEntries')
    expect(loaderSource).toContain('therapistId: params.userId')
  })

  it('uses cycle-specific, human-readable therapist copy', () => {
    expect(workspaceSource).toContain('Availability for This Cycle')
    expect(pageSource).toContain('Submitted Availability')
    expect(pageSource).toContain('No day-level entries yet for this cycle.')
    expect(pageSource).not.toContain('days selected')
    expect(loaderSource).toContain('fetchAvailabilitySubmissionRows')
  })

  it('loads active-cycle scheduled shifts and passes conflicts into the therapist workspace', () => {
    expect(pageSource).toContain(".from('shifts')")
    expect(pageSource).toContain(".eq('status', 'scheduled')")
    expect(pageSource).toContain('findScheduledConflicts(entries, scheduledShifts)')
    expect(pageSource).toContain('conflicts={conflicts}')
  })
})
