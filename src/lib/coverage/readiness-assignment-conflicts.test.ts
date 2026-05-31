import { describe, expect, it } from 'vitest'

import { buildIneligibleAssignmentReadinessInputs } from '@/lib/coverage/readiness-assignment-conflicts'

describe('buildIneligibleAssignmentReadinessInputs', () => {
  it('returns no conflicts when assigned therapists are active and not on FMLA', () => {
    expect(
      buildIneligibleAssignmentReadinessInputs({
        shifts: [
          {
            id: 'shift-1',
            user_id: 'therapist-1',
            date: '2026-05-04',
            shift_type: 'day',
          },
        ],
        profiles: [
          {
            id: 'therapist-1',
            full_name: 'Avery Chen',
            is_active: true,
            on_fmla: false,
            archived_at: null,
          },
        ],
      })
    ).toEqual([])
  })

  it('creates conflicts for inactive, archived, and FMLA assignments', () => {
    const conflicts = buildIneligibleAssignmentReadinessInputs({
      shifts: [
        {
          id: 'shift-fmla',
          user_id: 'therapist-fmla',
          date: '2026-05-05',
          shift_type: 'night',
        },
        {
          id: 'shift-inactive',
          user_id: 'therapist-inactive',
          date: '2026-05-04',
          shift_type: 'day',
        },
        {
          id: 'shift-archived',
          user_id: 'therapist-archived',
          date: '2026-05-04',
          shift_type: 'night',
        },
      ],
      profiles: [
        {
          id: 'therapist-inactive',
          full_name: 'Inactive Therapist',
          is_active: false,
          on_fmla: false,
          archived_at: null,
        },
        {
          id: 'therapist-archived',
          full_name: 'Archived Therapist',
          is_active: true,
          on_fmla: false,
          archived_at: '2026-05-01T12:00:00.000Z',
        },
        {
          id: 'therapist-fmla',
          full_name: 'FMLA Therapist',
          is_active: true,
          on_fmla: true,
          archived_at: null,
        },
      ],
    })

    expect(conflicts).toEqual([
      {
        shiftId: 'shift-inactive',
        therapistId: 'therapist-inactive',
        therapistName: 'Inactive Therapist',
        date: '2026-05-04',
        shiftType: 'day',
        reason: 'inactive',
      },
      {
        shiftId: 'shift-archived',
        therapistId: 'therapist-archived',
        therapistName: 'Archived Therapist',
        date: '2026-05-04',
        shiftType: 'night',
        reason: 'archived',
      },
      {
        shiftId: 'shift-fmla',
        therapistId: 'therapist-fmla',
        therapistName: 'FMLA Therapist',
        date: '2026-05-05',
        shiftType: 'night',
        reason: 'fmla',
      },
    ])
  })

  it('ignores unassigned shifts and shifts whose profile is unavailable', () => {
    expect(
      buildIneligibleAssignmentReadinessInputs({
        shifts: [
          { id: 'unassigned', user_id: null, date: '2026-05-04', shift_type: 'day' },
          { id: 'missing-profile', user_id: 'missing', date: '2026-05-04', shift_type: 'day' },
        ],
        profiles: [],
      })
    ).toEqual([])
  })
})
