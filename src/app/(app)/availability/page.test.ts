import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('availability page role-specific actions', () => {
  it('uses the therapist workspace anchor instead of the removed submit-entry target', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('#therapist-availability-workspace')
    expect(source).not.toContain('#submit-entry')
  })

  it('uses the therapist relationship when reading availability overrides', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('profiles!availability_overrides_therapist_id_fkey(full_name)')
  })

  it('loads official therapist submissions for manager response roster metrics', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('therapist_availability_submissions')
    expect(source).toContain('officialSubmissionTherapistIds')
  })

  it('loads override source and updated_at for roster metrics and review table', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'),
      'utf8'
    )
    expect(source).toContain('updated_at')
    expect(source).toContain('source')
    expect(source).toContain("entry.source === 'manager' ? 'manager' : 'therapist'")
  })

  it('passes the request inbox into the lower workbench section for managers', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'),
      'utf8'
    )
    expect(source).toContain(
      'reviewRequestsPanel={<div id="availability-request-inbox">{entriesCard}</div>}'
    )
    expect(source).toContain('formatHumanCycleRange')
  })

  it('uses the tighter manager header copy and summary-chip navigation for planner filters', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'),
      'utf8'
    )

    expect(source).toContain(
      "title={canManageAvailability ? 'Availability Planning' : 'Availability'}"
    )
    expect(source).toContain('AvailabilitySummaryChips')
    expect(source).not.toContain('selectedCycle.label')
    expect(source).toContain("roster: 'missing'")
    expect(source).toContain("roster: 'submitted'")
    expect(source).toContain("status: 'force_off'")
    expect(source).toContain("status: 'force_on'")
  })

  it('does not load therapist scheduled-shift conflict warnings in the manager availability path', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'),
      'utf8'
    )

    expect(source).not.toContain('findScheduledConflicts')
    expect(source).not.toContain('conflicts={conflicts}')
  })
})
