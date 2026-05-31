import { describe, expect, it } from 'vitest'

import {
  buildReadinessIssues,
  getBlockingReadinessIssues,
} from '@/lib/coverage/readiness-issues'

describe('buildReadinessIssues', () => {
  it('returns no issues when the pre-flight result has no row-level details', () => {
    expect(
      buildReadinessIssues({
        unfilledConstraintSlots: [],
        missingLeadSlotDetails: [],
        forcedMustWorkMissDetails: [],
        needOffConflictDetails: [],
      })
    ).toEqual([])
  })

  it('creates an unfilled assignment issue', () => {
    const issues = buildReadinessIssues({
      unfilledConstraintSlots: [{ date: '2026-04-07', shiftType: 'day', missingCount: 2 }],
      missingLeadSlotDetails: [],
      forcedMustWorkMissDetails: [],
      needOffConflictDetails: [],
    })

    expect(issues).toEqual([
      expect.objectContaining({
        id: 'unfilled-assignment:2026-04-07:day',
        severity: 'blocking',
        type: 'unfilled_assignment',
        date: '2026-04-07',
        shiftType: 'day',
        role: 'staff',
        title: 'Day shift is short 2 assignments',
        target: {
          kind: 'slot',
          date: '2026-04-07',
          shiftType: 'day',
          role: 'staff',
        },
      }),
    ])
  })

  it('creates a missing lead issue', () => {
    const issues = buildReadinessIssues({
      unfilledConstraintSlots: [],
      missingLeadSlotDetails: [{ date: '2026-04-08', shiftType: 'night' }],
      forcedMustWorkMissDetails: [],
      needOffConflictDetails: [],
    })

    expect(issues).toEqual([
      expect.objectContaining({
        id: 'missing-lead:2026-04-08:night',
        severity: 'blocking',
        type: 'missing_lead',
        role: 'lead',
        title: 'Night shift needs a lead',
        recommendedAction: 'Designate an eligible lead for this shift.',
      }),
    ])
  })

  it('creates a Need-to-Work miss issue with therapist metadata', () => {
    const issues = buildReadinessIssues({
      unfilledConstraintSlots: [],
      missingLeadSlotDetails: [],
      forcedMustWorkMissDetails: [
        {
          therapistId: 'therapist-1',
          therapistName: 'Avery Chen',
          date: '2026-04-09',
          shiftType: 'both',
        },
      ],
      needOffConflictDetails: [],
    })

    expect(issues).toEqual([
      expect.objectContaining({
        id: 'need-to-work-miss:2026-04-09:both:therapist-1',
        severity: 'blocking',
        type: 'need_to_work_miss',
        therapistId: 'therapist-1',
        therapistName: 'Avery Chen',
        title: 'Avery Chen is not scheduled on a Need to Work date',
        target: {
          kind: 'therapist_date',
          date: '2026-04-09',
          shiftType: 'both',
          therapistId: 'therapist-1',
        },
      }),
    ])
  })

  it('creates a Need Off conflict issue when detail rows are available', () => {
    const issues = buildReadinessIssues({
      unfilledConstraintSlots: [],
      missingLeadSlotDetails: [],
      forcedMustWorkMissDetails: [],
      needOffConflictDetails: [
        {
          therapistId: 'therapist-2',
          therapistName: null,
          date: '2026-04-10',
          shiftType: 'day',
        },
      ],
    })

    expect(issues).toEqual([
      expect.objectContaining({
        id: 'need-off-conflict:2026-04-10:day:therapist-2',
        severity: 'blocking',
        type: 'need_off_conflict',
        therapistName: 'Unknown therapist',
        title: 'Unknown therapist is scheduled on a Need Off date',
      }),
    ])
  })

  it('creates warning issues for missing availability submissions', () => {
    const issues = buildReadinessIssues(
      {
        unfilledConstraintSlots: [],
        missingLeadSlotDetails: [],
        forcedMustWorkMissDetails: [],
        needOffConflictDetails: [],
      },
      {
        missingAvailabilitySubmissions: {
          expectedTherapists: [
            { id: 'therapist-1', fullName: 'Avery Chen' },
            { id: 'therapist-2', fullName: 'Blair Morgan' },
            { id: 'therapist-3', fullName: null },
          ],
          submittedTherapistIds: ['therapist-1'],
          availabilityProvidedTherapistIds: ['therapist-2'],
        },
      }
    )

    expect(issues).toEqual([
      expect.objectContaining({
        id: 'missing-availability-submission:therapist-3',
        severity: 'warning',
        type: 'missing_availability_submission',
        therapistId: 'therapist-3',
        therapistName: 'Unknown therapist',
        title: 'Unknown therapist has not submitted availability',
        target: {
          kind: 'therapist',
          therapistId: 'therapist-3',
        },
      }),
    ])
  })

  it('creates warning issues for open Shift Board requests touching the block', () => {
    const issues = buildReadinessIssues(
      {
        unfilledConstraintSlots: [],
        missingLeadSlotDetails: [],
        forcedMustWorkMissDetails: [],
        needOffConflictDetails: [],
      },
      {
        openShiftBoardRequests: [
          {
            id: 'post-coverage-1',
            requestType: 'coverage',
            date: '2026-04-11',
            shiftType: 'day',
          },
          {
            id: 'post-trade-1',
            requestType: 'trade',
            date: '2026-04-12',
            shiftType: 'night',
          },
        ],
      }
    )

    expect(issues).toEqual([
      expect.objectContaining({
        id: 'open-shift-board-request:post-coverage-1',
        severity: 'warning',
        type: 'open_shift_board_request',
        date: '2026-04-11',
        shiftType: 'day',
        title: 'Coverage request is still open',
        target: {
          kind: 'shift_board_request',
          requestId: 'post-coverage-1',
          date: '2026-04-11',
          shiftType: 'day',
        },
      }),
      expect.objectContaining({
        id: 'open-shift-board-request:post-trade-1',
        severity: 'warning',
        type: 'open_shift_board_request',
        date: '2026-04-12',
        shiftType: 'night',
        title: 'Trade request is still open',
      }),
    ])
  })

  it('orders multiple issues deterministically by date, shift, category, and id', () => {
    const issues = buildReadinessIssues(
      {
        unfilledConstraintSlots: [
          { date: '2026-04-09', shiftType: 'night', missingCount: 1 },
          { date: '2026-04-07', shiftType: 'day', missingCount: 1 },
        ],
        missingLeadSlotDetails: [
          { date: '2026-04-07', shiftType: 'day' },
          { date: '2026-04-07', shiftType: 'night' },
        ],
        forcedMustWorkMissDetails: [
          {
            therapistId: 'therapist-b',
            therapistName: 'Blair',
            date: '2026-04-07',
            shiftType: 'day',
          },
        ],
        needOffConflictDetails: [
          {
            therapistId: 'therapist-a',
            therapistName: 'Ari',
            date: '2026-04-07',
            shiftType: 'day',
          },
        ],
      },
      {
        missingAvailabilitySubmissions: {
          expectedTherapists: [{ id: 'therapist-c', fullName: 'Casey' }],
          submittedTherapistIds: [],
          availabilityProvidedTherapistIds: [],
        },
        openShiftBoardRequests: [
          {
            id: 'post-1',
            requestType: 'coverage',
            date: '2026-04-07',
            shiftType: 'day',
          },
        ],
      }
    )

    expect(issues.map((issue) => issue.id)).toEqual([
      'unfilled-assignment:2026-04-07:day',
      'missing-lead:2026-04-07:day',
      'need-to-work-miss:2026-04-07:day:therapist-b',
      'need-off-conflict:2026-04-07:day:therapist-a',
      'open-shift-board-request:post-1',
      'missing-lead:2026-04-07:night',
      'unfilled-assignment:2026-04-09:night',
      'missing-availability-submission:therapist-c',
    ])
  })

  it('filters blocking readiness issues for schedule actions', () => {
    const issues = buildReadinessIssues(
      {
        unfilledConstraintSlots: [],
        missingLeadSlotDetails: [{ date: '2026-04-08', shiftType: 'night' }],
        forcedMustWorkMissDetails: [
          {
            therapistId: 'therapist-b',
            therapistName: 'Blair',
            date: '2026-04-09',
            shiftType: 'day',
          },
        ],
        needOffConflictDetails: [],
      },
      {
        openShiftBoardRequests: [
          {
            id: 'post-1',
            requestType: 'coverage',
            date: '2026-04-09',
            shiftType: 'day',
          },
        ],
      }
    )

    expect(getBlockingReadinessIssues(issues).map((issue) => issue.type)).toEqual([
      'missing_lead',
      'need_to_work_miss',
    ])
  })
})
