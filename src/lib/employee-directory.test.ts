import { describe, expect, it } from 'vitest'

import {
  buildManagerOverrideInput,
  buildMissingAvailabilityRows,
  canTherapistMutateOverride,
  filterEmployeeDirectoryRecords,
  getSchedulingEligibleEmployees,
  isFmlaReturnDateEnabled,
  normalizeFmlaReturnDate,
  type EmployeeAvailabilityOverride,
  type EmployeeDirectoryRecord,
} from '@/lib/employee-directory'

const sampleEmployees: EmployeeDirectoryRecord[] = [
  {
    id: '1',
    full_name: 'Ava Patel',
    email: 'ava@example.com',
    phone_number: null,
    shift_type: 'day',
    employment_type: 'full_time',
    max_work_days_per_week: 3,
    works_dow: [1, 2, 3],
    offs_dow: [0],
    weekend_rotation: 'every_other',
    weekend_anchor_date: '2026-02-21',
    works_dow_mode: 'hard',
    is_lead_eligible: true,
    on_fmla: false,
    fmla_return_date: null,
    is_active: true,
  },
  {
    id: '2',
    full_name: 'Marcus Reed',
    email: 'marcus@example.com',
    phone_number: null,
    shift_type: 'night',
    employment_type: 'prn',
    max_work_days_per_week: 1,
    works_dow: [5, 6],
    offs_dow: [2, 3],
    weekend_rotation: 'none',
    weekend_anchor_date: null,
    works_dow_mode: 'soft',
    is_lead_eligible: false,
    on_fmla: true,
    fmla_return_date: '2026-06-01',
    is_active: true,
  },
  {
    id: '3',
    full_name: 'Nina Lopez',
    email: 'nina@example.com',
    phone_number: null,
    shift_type: 'day',
    employment_type: 'part_time',
    max_work_days_per_week: 2,
    works_dow: [1, 4],
    offs_dow: [],
    weekend_rotation: 'none',
    weekend_anchor_date: null,
    works_dow_mode: 'hard',
    is_lead_eligible: false,
    on_fmla: false,
    fmla_return_date: null,
    is_active: false,
  },
]

describe('employee directory helpers', () => {
  it('filters by lead, fmla, and inactive toggles', () => {
    const filtered = filterEmployeeDirectoryRecords(sampleEmployees, {
      tab: 'all',
      searchText: '',
      leadOnly: true,
      fmlaOnly: false,
      includeInactive: false,
    })

    expect(filtered.map((row) => row.id)).toEqual(['1'])

    const fmlaOnly = filterEmployeeDirectoryRecords(sampleEmployees, {
      tab: 'all',
      searchText: '',
      leadOnly: false,
      fmlaOnly: true,
      includeInactive: false,
    })
    expect(fmlaOnly.map((row) => row.id)).toEqual(['2'])

    const includeInactive = filterEmployeeDirectoryRecords(sampleEmployees, {
      tab: 'all',
      searchText: '',
      leadOnly: false,
      fmlaOnly: false,
      includeInactive: true,
    })
    expect(includeInactive.map((row) => row.id)).toEqual(['1', '2', '3'])
  })

  it('supports deactivate/reactivate view behavior via includeInactive', () => {
    const activeOnly = filterEmployeeDirectoryRecords(sampleEmployees, {
      tab: 'all',
      searchText: '',
      leadOnly: false,
      fmlaOnly: false,
      includeInactive: false,
    })
    expect(activeOnly.some((row) => !row.is_active)).toBe(false)

    const withInactive = filterEmployeeDirectoryRecords(sampleEmployees, {
      tab: 'all',
      searchText: '',
      leadOnly: false,
      fmlaOnly: false,
      includeInactive: true,
    })
    expect(withInactive.some((row) => !row.is_active)).toBe(true)
  })

  it('enables/disables and clears fmla return date correctly', () => {
    expect(isFmlaReturnDateEnabled(true)).toBe(true)
    expect(isFmlaReturnDateEnabled(false)).toBe(false)

    expect(normalizeFmlaReturnDate('2026-05-12', true)).toBe('2026-05-12')
    expect(normalizeFmlaReturnDate('', true)).toBeNull()
    expect(normalizeFmlaReturnDate('2026-05-12', false)).toBeNull()
  })

  it('excludes fmla and inactive employees from auto-scheduling eligibility', () => {
    const eligible = getSchedulingEligibleEmployees(sampleEmployees)
    expect(eligible.map((row) => row.id)).toEqual(['1'])
  })

  it('builds manager-entered override payload with source=manager', () => {
    expect(
      buildManagerOverrideInput({
        cycleId: 'cycle-1',
        therapistId: 'therapist-1',
        date: '2026-03-01',
        shiftType: 'both',
        overrideType: 'force_off',
        note: ' Vacation ',
        managerId: 'manager-1',
      })
    ).toMatchObject({
      cycle_id: 'cycle-1',
      therapist_id: 'therapist-1',
      date: '2026-03-01',
      shift_type: 'both',
      override_type: 'force_off',
      note: 'Vacation',
      created_by: 'manager-1',
      source: 'manager',
    })
  })

  it('blocks therapist mutation of manager-entered override rows', () => {
    const managerOverride: EmployeeAvailabilityOverride = {
      id: 'ov-1',
      therapist_id: 'therapist-1',
      cycle_id: 'cycle-1',
      date: '2026-03-01',
      shift_type: 'both',
      override_type: 'force_off',
      note: null,
      created_at: '2026-02-27T12:00:00.000Z',
      source: 'manager',
    }
    const therapistOverride: EmployeeAvailabilityOverride = {
      ...managerOverride,
      id: 'ov-2',
      source: 'therapist',
    }

    expect(canTherapistMutateOverride(managerOverride, 'therapist-1')).toBe(false)
    expect(canTherapistMutateOverride(therapistOverride, 'therapist-1')).toBe(true)
  })

  it('identifies missing availability by cycle', () => {
    const rows = buildMissingAvailabilityRows(
      sampleEmployees,
      [
        {
          id: 'ov-1',
          therapist_id: '1',
          cycle_id: 'cycle-a',
          date: '2026-03-01',
          shift_type: 'both',
          override_type: 'force_off',
          note: null,
          created_at: '2026-02-27T12:00:00.000Z',
          source: 'therapist',
        },
      ],
      'cycle-a'
    )

    const byId = new Map(rows.map((row) => [row.therapistId, row]))
    expect(byId.get('1')?.submitted).toBe(true)
    expect(byId.get('2')?.submitted).toBe(false)
    expect(byId.get('2')?.overridesCount).toBe(0)
  })
})
