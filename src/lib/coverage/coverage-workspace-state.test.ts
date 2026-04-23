import { describe, expect, it } from 'vitest'

import {
  getCoverageActionBarStatusHint,
  getCoverageNextActionLabel,
  getCoveragePlanningNotices,
  getCoverageWorkspaceDescription,
  getCoverageWorkspaceStatus,
} from '@/lib/coverage/coverage-workspace-state'

describe('coverage workspace state helpers', () => {
  it('returns the expected workspace badge state for a published cycle', () => {
    expect(
      getCoverageWorkspaceStatus({
        noCycleSelected: false,
        activeCyclePublished: true,
        showEmptyDraftState: false,
      })
    ).toEqual({
      workspaceStatusTone: 'success',
      workspaceStatusLabel: 'Published',
    })
  })

  it('prioritizes the no-cycle action-bar guidance', () => {
    expect(
      getCoverageActionBarStatusHint({
        noCycleSelected: true,
        selectedCycleHasShiftRows: false,
        activeCyclePublished: false,
        canSendPreliminary: false,
        canPublishCycle: false,
      })
    ).toBe('Create a 6-week block to start the scheduling workflow.')
  })

  it('returns staff-facing next-step copy for a live cycle', () => {
    expect(
      getCoverageNextActionLabel({
        noCycleSelected: false,
        canManageCoverage: false,
        showEmptyDraftState: false,
        activeCyclePublished: true,
      })
    ).toBe('View live staffing and operational status.')
  })

  it('collects planning notices from success and error params', () => {
    expect(
      getCoveragePlanningNotices({
        successParam: 'preliminary_sent',
        errorParam: 'preliminary_send_failed',
        autoDraftFeedbackMessage: null,
        publishErrorMessage: 'Publish blocked: weekly rule violation.',
        error: 'Could not refresh staffing.',
      })
    ).toEqual([
      'Preliminary schedule sent. Therapists can now review it in the app.',
      'Publish blocked: weekly rule violation.',
      'Could not send the preliminary schedule. Please try again.',
      'Could not refresh staffing.',
    ])
  })

  it('returns the right non-manager description when status editing is available', () => {
    expect(
      getCoverageWorkspaceDescription({
        noCycleSelected: false,
        canManageCoverage: false,
        showEmptyDraftState: false,
        canUpdateAssignmentStatus: true,
      })
    ).toBe('View staffing and assignment status — click a therapist token to update status.')
  })
})
