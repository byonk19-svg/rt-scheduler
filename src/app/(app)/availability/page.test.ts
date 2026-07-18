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
    expect(source).toContain('resolveAvailabilityRosterFilter')
    expect(source).toContain('requestedFilter: initialRoster')
    expect(source).toContain('initialRosterFilter={initialRosterFilter}')
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

  it('surfaces required manager availability read failures instead of rendering empty data', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'),
      'utf8'
    )

    expect(source).toContain('function AvailabilityManagerLoadError()')
    expect(source).toContain('Could not load Availability Manager.')
    expect(source).toContain('if (profileError) return availabilityLoadError')
    expect(source).toContain('if (cyclesError) return availabilityLoadError')
    expect(source).toContain('if (draftScheduleResult.error)')
    expect(source).toContain('if (entriesResult.error)')
    expect(source).toContain('if (plannerTherapistsResult.error)')
    expect(source).toContain('if (plannerOverridesResult.error)')
    expect(source).toContain('if (officialSubmissionRowsError)')
  })

  it('site-scopes manager availability cycles and therapist roster', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'),
      'utf8'
    )

    expect(source).toContain("select('role, is_active, archived_at, site_id')")
    expect(source).toContain("availabilityLoadError('availability manager site'")
    expect(
      source.match(/\.eq\('site_id', profile\.site_id\)/g)?.length ?? 0
    ).toBeGreaterThanOrEqual(2)
    expect(source).toContain(".eq('on_fmla', false)")
  })

  it('preserves successful empty availability states after checking for required read errors', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'),
      'utf8'
    )
    const managerInputsSource = readFileSync(
      resolve(process.cwd(), 'src/components/availability/ManagerSchedulingInputs.tsx'),
      'utf8'
    )

    expect(source.indexOf('if (cyclesError)')).toBeLessThan(
      source.indexOf('const cycles = (cyclesData ?? []) as Cycle[]')
    )
    expect(source.indexOf('if (entriesResult.error)')).toBeLessThan(
      source.indexOf('const entries = (entriesResult.data ?? []) as AvailabilityRow[]')
    )
    expect(source.indexOf('if (plannerTherapistsResult.error)')).toBeLessThan(
      source.indexOf('const plannerTherapists = (plannerTherapistsResult.data ?? [])')
    )
    expect(source.indexOf('if (officialSubmissionRowsError)')).toBeLessThan(
      source.indexOf('(officialSubmissionRows ?? []).map')
    )
    expect(source).toContain(': { data: [], error: null }')
    expect(managerInputsSource).toContain('No Schedule Block is ready for availability.')
    expect(managerInputsSource).toContain('No active therapists are available to review right now.')
  })

  it('keeps optional intake badge failures out of the required load-error path', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'),
      'utf8'
    )

    expect(source).toContain('if (intakeReviewCountError)')
    expect(source).toContain("console.warn('Could not load availability intake review count:'")
    expect(source).toContain('const intakeNeedsReviewCount = intakeReviewCount ?? 0')
    expect(source).not.toContain("availabilityLoadError('availability intake review count'")
  })

  it('uses explicit feedback for availability overwrite conflicts', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'),
      'utf8'
    )

    expect(source).toContain("error === 'availability_conflict'")
    expect(source).toContain("error === 'planner_availability_conflict'")
    expect(source).toContain("error === 'manager_request_availability_conflict'")
    expect(source).toContain("error === 'email_intake_availability_conflict'")
    expect(source).toContain('already has therapist-submitted availability')
    expect(source).toContain('already has manager-entered availability')
  })
})
