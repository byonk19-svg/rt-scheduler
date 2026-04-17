import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('availability page role-specific actions', () => {
  it('uses the therapist workspace anchor instead of the removed submit-entry target', () => {
    const filePath = resolve(process.cwd(), 'src/app/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('#therapist-availability-workspace')
    expect(source).not.toContain('#submit-entry')
  })

  it('uses the therapist relationship when reading availability overrides', () => {
    const filePath = resolve(process.cwd(), 'src/app/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('profiles!availability_overrides_therapist_id_fkey(full_name)')
  })

  it('loads official therapist submissions for manager response roster metrics', () => {
    const filePath = resolve(process.cwd(), 'src/app/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('therapist_availability_submissions')
    expect(source).toContain('officialSubmissionTherapistIds')
  })

  it('loads override source and updated_at for roster metrics and review table', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/availability/page.tsx'), 'utf8')
    expect(source).toContain('updated_at')
    expect(source).toContain('source')
    expect(source).toContain("entry.source === 'manager' ? 'manager' : 'therapist'")
  })

  it('embeds the review table beside the roster column for managers', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/availability/page.tsx'), 'utf8')
    expect(source).toContain('reviewRequestsPanel={entriesCard}')
    expect(source).toContain('formatHumanCycleRange')
  })

  it('queries scheduled shifts for the active therapist cycle and passes conflicts into the workspace', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/availability/page.tsx'), 'utf8')

    expect(source).toContain(".from('shifts')")
    expect(source).toContain(".eq('status', 'scheduled')")
    expect(source).toContain('findScheduledConflicts(entries, scheduledShifts)')
    expect(source).toContain('conflicts={conflicts}')
  })
})
