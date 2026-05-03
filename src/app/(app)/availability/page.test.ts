import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('availability page role-specific actions', () => {
  it('removes the old therapist submit-entry anchor from the manager surface', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).not.toContain('#submit-entry')
    expect(source).toContain("title: 'Availability Manager'")
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
    expect(source).toContain('created_by')
    expect(source).toContain('source')
    expect(source).toContain("entry.source === 'manager' ? 'manager' : 'therapist'")
  })

  it('passes manager request save behavior into the review-and-manual-entry workflow', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'),
      'utf8'
    )
    expect(source).toContain(
      'saveManagerAvailabilityRequestsAction={saveManagerAvailabilityRequestsAction}'
    )
    expect(source).toContain(
      'copyAvailabilityFromPreviousCycleAction={copyAvailabilityFromPreviousCycleAction}'
    )
    expect(source).toContain('toolbarUtilities=')
    expect(source).toContain('Email intake')
  })

  it('uses the simplified manager shell and work-queue tab label', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'),
      'utf8'
    )

    expect(source).toContain("title: 'Availability Manager'")
    expect(source).not.toContain('AvailabilityOverviewHeader')
    expect(source).toContain('Email intake')
    expect(source).toContain('toolbarUtilities=')
    expect(source).toContain("initialRoster === 'all'")
  })

  it('gates therapist scheduled-shift conflict warnings off for managers', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'),
      'utf8'
    )

    expect(source).not.toContain('findScheduledConflicts')
    expect(source).not.toContain('const scheduledShiftsPromise =')
    expect(source).not.toContain('conflicts={conflicts}')
  })
})
