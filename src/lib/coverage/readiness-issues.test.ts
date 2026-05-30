import { describe, expect, it } from 'vitest'

import { buildReadinessIssues } from '@/lib/coverage/readiness-issues'

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
        severity: 'warning',
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

  it('orders multiple issues deterministically by date, shift, category, and id', () => {
    const issues = buildReadinessIssues({
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
    })

    expect(issues.map((issue) => issue.id)).toEqual([
      'unfilled-assignment:2026-04-07:day',
      'missing-lead:2026-04-07:day',
      'need-to-work-miss:2026-04-07:day:therapist-b',
      'need-off-conflict:2026-04-07:day:therapist-a',
      'missing-lead:2026-04-07:night',
      'unfilled-assignment:2026-04-09:night',
    ])
  })
})
