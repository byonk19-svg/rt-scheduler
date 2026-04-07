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
    const filePath = resolve(process.cwd(), 'src/app/therapist/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('Availability for This Cycle')
    expect(source).toContain('Submitted Availability')
    expect(source).toContain('No day-level entries yet for this cycle.')
    expect(source).toContain('days selected')
    expect(source).toContain('formatHumanCycleRange')
    expect(source).toContain('Availability summary:')
    expect(source).toContain('therapist_availability_submissions')
  })
})
