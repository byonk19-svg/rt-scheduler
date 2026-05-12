import { describe, expect, it } from 'vitest'

import {
  DRAFT_AVAILABILITY_OVERRIDE_COLUMNS,
  DRAFT_EXISTING_SHIFT_COLUMNS,
  DRAFT_THERAPIST_COLUMNS,
  DRAFT_WEEKLY_SHIFT_COLUMNS,
  DRAFT_WORK_PATTERN_COLUMNS,
  buildDraftTherapists,
  toDraftExistingShifts,
} from '@/lib/coverage/draft-inputs'

describe('draft input loader helpers', () => {
  it('keeps the shared draft query columns in one module', () => {
    expect(DRAFT_THERAPIST_COLUMNS).toContain('max_work_days_per_week')
    expect(DRAFT_WORK_PATTERN_COLUMNS).toContain('cycle_segments')
    expect(DRAFT_EXISTING_SHIFT_COLUMNS).toContain('unfilled_reason')
    expect(DRAFT_AVAILABILITY_OVERRIDE_COLUMNS).toContain('source')
    expect(DRAFT_WEEKLY_SHIFT_COLUMNS).toBe('user_id, date, status')
  })

  it('normalizes therapist rows into the generateDraftForCycle input shape', () => {
    const therapists = buildDraftTherapists(
      [
        {
          id: 'therapist-1',
          full_name: 'A Therapist',
          shift_type: 'day',
          is_lead_eligible: null,
          employment_type: null,
          max_work_days_per_week: null,
          on_fmla: null,
          fmla_return_date: null,
          is_active: null,
        },
      ],
      []
    )

    expect(therapists[0]).toMatchObject({
      id: 'therapist-1',
      is_lead_eligible: false,
      employment_type: 'full_time',
      max_work_days_per_week: 0,
      shift_preference: 'either',
      on_fmla: false,
      is_active: true,
    })
  })

  it('keeps PRN therapists without saved work patterns in flexible mode', () => {
    const therapists = buildDraftTherapists(
      [
        {
          id: 'prn-1',
          full_name: 'Flexible PRN',
          shift_type: 'day',
          is_lead_eligible: false,
          employment_type: 'prn',
          max_work_days_per_week: null,
          on_fmla: false,
          fmla_return_date: null,
          is_active: true,
        },
      ],
      []
    )

    expect(therapists[0]?.pattern?.pattern_type).toBe('none')
    expect(therapists[0]?.pattern?.works_dow).toEqual([])
  })

  it('filters unfilled placeholders out of existing draft shifts', () => {
    expect(
      toDraftExistingShifts([
        {
          user_id: null,
          date: '2026-04-07',
          shift_type: 'day',
          status: 'scheduled',
          role: 'staff',
          unfilled_reason: 'no_eligible_candidates_due_to_constraints',
        },
        {
          user_id: 'therapist-1',
          date: '2026-04-07',
          shift_type: 'day',
          status: 'scheduled',
          role: 'staff',
          unfilled_reason: null,
        },
      ])
    ).toEqual([
      {
        user_id: 'therapist-1',
        date: '2026-04-07',
        shift_type: 'day',
        status: 'scheduled',
        role: 'staff',
        unfilled_reason: null,
      },
    ])
  })
})
