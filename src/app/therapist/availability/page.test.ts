import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('therapist availability route', () => {
  it('is no longer a direct re-export of the manager availability page', () => {
    const filePath = resolve(process.cwd(), 'src/app/therapist/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).not.toContain("export { default } from '../../availability/page'")
    expect(source).toContain('TherapistAvailabilityWorkspace')
  })

  it('uses the therapist relationship when reading availability overrides', () => {
    const filePath = resolve(process.cwd(), 'src/app/therapist/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('profiles!availability_overrides_therapist_id_fkey(full_name)')
  })

  it('uses cycle-specific, human-readable therapist copy', () => {
    const pagePath = resolve(process.cwd(), 'src/app/therapist/availability/page.tsx')
    const workspacePath = resolve(
      process.cwd(),
      'src/components/availability/TherapistAvailabilityWorkspace.tsx'
    )
    const pageSource = readFileSync(pagePath, 'utf8')
    const workspaceSource = readFileSync(workspacePath, 'utf8')

    expect(workspaceSource).toContain('Availability for This Cycle')
    expect(pageSource).toContain('Submitted Availability')
    expect(pageSource).toContain('No day-level entries yet for this cycle.')
    expect(pageSource).not.toContain('days selected')
    expect(pageSource).toContain('therapist_availability_submissions')
  })

  it('loads active-cycle scheduled shifts and passes conflict warnings into the therapist workspace', () => {
    const filePath = resolve(process.cwd(), 'src/app/therapist/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain(".from('shifts')")
    expect(source).toContain(".eq('status', 'scheduled')")
    expect(source).toContain('findScheduledConflicts(entries, scheduledShifts)')
    expect(source).toContain('conflicts={conflicts}')
  })
})
