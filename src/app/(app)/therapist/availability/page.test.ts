import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('therapist availability route', () => {
  it('is no longer a direct re-export of the manager availability page', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/therapist/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).not.toContain("export { default } from '../../availability/page'")
    expect(source).toContain('TherapistAvailabilityWorkspace')
  })

  it('uses the therapist relationship when reading availability overrides', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/therapist/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('profiles!availability_overrides_therapist_id_fkey(full_name)')
  })

  it('uses cycle-specific, human-readable therapist copy', () => {
    const pagePath = resolve(process.cwd(), 'src/app/(app)/therapist/availability/page.tsx')
    const workspacePath = resolve(
      process.cwd(),
      'src/components/availability/TherapistAvailabilityWorkspace.tsx'
    )
    const pageSource = readFileSync(pagePath, 'utf8')
    const workspaceSource = readFileSync(workspacePath, 'utf8')

    expect(workspaceSource).toContain('Future Availability')
    expect(pageSource).toContain('resolveTherapistAvailabilityCycleId')
    expect(pageSource).toContain("'preliminary_snapshots'")
    expect(pageSource).toContain('No exceptions selected for this Schedule Block.')
    expect(pageSource).toContain('Current Draft')
    expect(pageSource).toContain('No Submitted Availability')
    expect(pageSource).toContain('Submitted Availability')
    expect(pageSource).not.toContain('days selected')
    expect(pageSource).toContain('therapist_availability_submissions')
    expect(pageSource).toContain('role, shift_type, work_patterns')
    expect(pageSource).toContain('regularShiftType={regularShiftType}')
    expect(workspaceSource).toContain('Review before submitting')
  })

  it('sets route-specific metadata and recurring-pattern wording', () => {
    const pagePath = resolve(process.cwd(), 'src/app/(app)/therapist/availability/page.tsx')
    const workspacePath = resolve(
      process.cwd(),
      'src/components/availability/TherapistAvailabilityWorkspace.tsx'
    )
    const pageSource = readFileSync(pagePath, 'utf8')
    const workspaceSource = readFileSync(workspacePath, 'utf8')

    expect(pageSource).toContain("title: 'Future Availability'")
    expect(workspaceSource).toContain('Review normal schedule')
    expect(workspaceSource).toContain('Set normal schedule')
  })

  it('keeps therapist future availability focused on upcoming non-published cycles', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/therapist/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain(".eq('published', false)")
    expect(source).toContain('isTherapistVisibleForAvailability(cycle, todayKey)')
    expect(source).toContain('sortVisibleAvailabilityCycles')
  })

  it('passes per-cycle availability window state into the client workspace', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/therapist/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('resolveAvailabilityWindowState')
    expect(source).toContain('resolveTherapistAvailabilityWritePermission')
    expect(source).toContain("admin.from('shifts')")
    expect(source).toContain(".select('cycle_id')")
    expect(source).toContain(".in('cycle_id', visibleCycleIds)")
    expect(source).toContain('Boolean(submissionsByCycleId[cycle.id])')
    expect(source).toContain('availabilityWindowByCycleId')
  })

  it('uses closed-state table copy without calling unsubmitted read-only rows a draft', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/therapist/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('const isSelectedCycleReadOnly = Boolean')
    expect(source).toContain("? 'No Submitted Availability'")
    expect(source).toContain("? 'Submitted Availability'")
    expect(source).toContain(": 'Current Draft'")
    expect(source).toContain(
      'No exceptions were submitted for this Schedule Block. Your normal schedule will be used.'
    )
    expect(source).toContain(
      'Your normal schedule remains the starting point for this Schedule Block.'
    )
    expect(source).toContain(
      'These saved exceptions are still a draft until you submit availability.'
    )
  })

  it('loads active-cycle scheduled shifts and passes conflicts into the therapist workspace', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/therapist/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain(".from('shifts')")
    expect(source).toContain(".eq('status', 'scheduled')")
    expect(source).toContain('findScheduledConflicts(entries, scheduledShifts)')
    expect(source).toContain('conflicts={conflicts}')
  })

  it('passes a server-owned today key into the client workspace', () => {
    const pagePath = resolve(process.cwd(), 'src/app/(app)/therapist/availability/page.tsx')
    const workspacePath = resolve(
      process.cwd(),
      'src/components/availability/TherapistAvailabilityWorkspace.tsx'
    )
    const pageSource = readFileSync(pagePath, 'utf8')
    const workspaceSource = readFileSync(workspacePath, 'utf8')

    expect(pageSource).toContain('const todayKey = toIsoDate(today)')
    expect(pageSource).toContain('todayKey={todayKey}')
    expect(workspaceSource).toContain('todayKey: string')
    expect(workspaceSource).not.toContain('const todayKey = toIsoDate(new Date())')
  })
})
