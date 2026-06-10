import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = () =>
  readFileSync(resolve(process.cwd(), 'src/components/schedule-grid/ScheduleGrid.tsx'), 'utf8')
const toolbarSource = () =>
  readFileSync(
    resolve(process.cwd(), 'src/components/schedule-grid/ScheduleGridToolbar.tsx'),
    'utf8'
  )

describe('ScheduleGrid source invariants', () => {
  it('binds structural mutations to the loaded dataset shift', () => {
    const code = source()

    expect(code).toContain('shiftType: initialDataset.shiftType')
    expect(code).not.toContain('shiftType: shiftTabToQueryValue(shiftTab)')
  })

  it('locks cell interactions while a route or mutation transition is pending', () => {
    const code = source()

    expect(code).toContain('const cellsLocked = isPending')
    expect(code).toContain('startTransition(() => {')
    expect(code).toContain('router.replace(`${pathname}?${query}`, { scroll: false })')
    expect(code).toContain('window.location.search')
    expect(code).toContain('latestQueryRef.current = query')
    expect(code).toContain('if (cellsLocked) return')
    expect(code).toContain('interactionsDisabled={cellsLocked}')
  })

  it('allows manager assignment on published schedule cells through the unified grid', () => {
    const code = source()
    const handleAssignBlock = code.slice(
      code.indexOf('const handleAssign = useCallback'),
      code.indexOf('const handleUnassign = useCallback')
    )

    expect(handleAssignBlock).toContain('interactionMode.canAssignShifts')
    expect(handleAssignBlock).not.toContain('!initialDataset.isPublished')
  })

  it('gates schedule interactions through the explicit interaction mode', () => {
    const code = source()
    const toolbarCode = toolbarSource()

    expect(code).toContain('const interactionMode = initialDataset.interactionMode')
    expect(code).toContain('interactionMode.canAssignShifts')
    expect(code).toContain('interactionMode.canUnassignShifts')
    expect(code).toContain('interactionMode.canDesignateLead')
    expect(code).toContain('interactionMode.canUpdateAssignmentStatus')
    expect(toolbarCode).toContain('interactionMode.canUseManagerToolbar')
  })

  it('uses explicit shift labels in the toolbar', () => {
    const code = toolbarSource()

    expect(code).toContain('{tab} shift')
    expect(code).toContain('Schedule Block')
  })

  it('uses real Schedule Block lifecycle labels and plain schedule terminology', () => {
    const code = source()
    const toolbarCode = toolbarSource()
    const assignPopoverCode = readFileSync(
      resolve(process.cwd(), 'src/components/schedule-grid/AssignCellPopover.tsx'),
      'utf8'
    )
    const statusPopoverCode = readFileSync(
      resolve(process.cwd(), 'src/components/schedule-grid/StatusCellPopover.tsx'),
      'utf8'
    )
    const visibleScheduleCopy = [code, assignPopoverCode, statusPopoverCode].join('\n')

    expect(toolbarCode).toContain('getScheduleBlockLifecycleLabel')
    expect(toolbarCode).toContain('scheduleBlockStateLabel')
    expect(toolbarCode).not.toContain("isPublished ? 'Published' : 'Draft'")
    expect(code).toContain("label: 'Need Off'")
    expect(code).toContain("label: 'Lead', code: 'L'")
    expect(visibleScheduleCopy).toContain('Need Off is marked for this date.')
    expect(visibleScheduleCopy).not.toContain("label: 'Requested off'")
    expect(visibleScheduleCopy).not.toContain('Requested this day off.')
  })

  it('makes missing-availability publish acknowledgement an explicit second submit state', () => {
    const code = source()
    const toolbarCode = toolbarSource()

    expect(code).toContain("searchParams.get('error') === 'publish_missing_availability_warning'")
    expect(code).toContain('name="acknowledge_missing_availability"')
    expect(code).toContain('Publish with missing availability')
    expect(toolbarCode).toContain('publishLabel')
  })

  it('maps each interaction mode to a concise visible grid hint', () => {
    const code = source()

    expect(code).toContain('function getScheduleInteractionHint')
    expect(code).toContain("case 'manager_edit'")
    expect(code).toContain('Select actionable cells to edit coverage or update shift status.')
    expect(code).toContain("case 'lead_status'")
    expect(code).toContain(
      'Select assigned published shifts to update live status. Off cells are read-only.'
    )
    expect(code).toContain("case 'combined_readonly'")
    expect(code).toContain('Read-only combined schedule view.')
    expect(code).toContain("case 'staff_view'")
    expect(code).toContain('Read-only team schedule. Your row is highlighted for quick reference.')
  })

  it('renders the interaction hint in the compact legend strip', () => {
    const code = source()

    expect(code).toContain('const interactionHint = getScheduleInteractionHint(interactionMode)')
    expect(code).toContain('aria-label="Schedule legend"')
    expect(code).toContain('{interactionHint}')
    expect(code).toContain('border-l border-border/60')
  })

  it('adds a compact paper-style title inside the schedule grid', () => {
    const code = source()

    expect(code).toContain('Night shift schedule')
    expect(code).toContain('Day shift schedule')
    expect(code).toContain('cycleDateRangeLabel')
    expect(code).toContain('{sheetTitle}')
    expect(code).not.toContain('Respiratory Therapy Day Shift')
    expect(code).not.toContain('Respiratory Therapy Night Shift')
  })

  it('renders the confidentiality footer only on the print schedule surface', () => {
    const code = source()

    expect(code).toContain('Internal Use Only - Teamwise schedule information')
    expect(code).toContain('should not be shared outside approved channels.')
    expect(code).toContain('<footer className="print-only')
    expect(code).toContain('text-[var(--print-ink-muted)]')
  })

  it('keeps readiness issue target copy ASCII-safe', () => {
    const code = source()

    expect(code).toContain("shift - ${issue.therapistName ?? 'Therapist'}")
    expect(code).not.toContain('Â·')
  })

  it('uses non-blocking feedback for schedule mutation failures', () => {
    const code = source()

    expect(code).toContain('FeedbackToast')
    expect(code).not.toContain('window.alert')
    expect(code).toContain('Could not assign this shift. Refresh Schedule and try again.')
    expect(code).toContain('Could not remove this assignment. Refresh Schedule and try again.')
    expect(code).toContain('Could not update this shift status. Refresh Schedule and try again.')
    expect(code).toContain('Could not set the lead for this shift. Refresh Schedule and try again.')
  })

  it('uses operational status terminology for visible schedule status errors', () => {
    const code = source()
    const routeCode = readFileSync(
      resolve(process.cwd(), 'src/app/api/schedule/assignment-status/route.ts'),
      'utf8'
    )
    const visibleStatusErrorSource = [code, routeCode].join('\n')

    expect(visibleStatusErrorSource).toContain(
      'Operational statuses can only be applied after the Schedule Block is published.'
    )
    expect(visibleStatusErrorSource).toContain(
      'Operational statuses require an assigned therapist.'
    )
    expect(visibleStatusErrorSource).not.toContain('Incident statuses')
  })

  it('renders pre-flight readiness issues from the shared helper output', () => {
    const code = source()
    const dataCode = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/schedule/schedule-grid-data.ts'),
      'utf8'
    )

    expect(dataCode).toContain('buildReadinessIssues(preFlightResult, {')
    expect(dataCode).toContain('therapist_availability_submissions')
    expect(dataCode).toContain('missingAvailabilitySubmissions')
    expect(dataCode).toContain('loadIneligibleAssignmentReadinessInputsForCycle')
    expect(dataCode).toContain('ineligibleAssignments')
    expect(dataCode).toContain("from('shift_posts')")
    expect(dataCode).toContain("in('shift_id', shiftIds)")
    expect(dataCode).toContain("in('swap_shift_id', shiftIds)")
    expect(dataCode).toContain('openShiftBoardRequests')
    expect(code).toContain('MAX_VISIBLE_PREFLIGHT_ISSUES')
    expect(code).toContain('Pre-flight readiness issues')
    expect(code).toContain('data-readiness-issue-id')
    expect(code).toContain('issue.recommendedAction')
    expect(code).toContain('getReadinessTargetLabel')
    expect(code).toContain('missing_availability_submission')
    expect(code).toContain('open_shift_board_request')
    expect(code).not.toContain('buildReadinessIssues(')
  })
})
