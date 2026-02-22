import { describe, expect, it } from 'vitest'

import {
  filterEmployeeDirectoryRecords,
  getSchedulingEligibleEmployees,
  isFmlaReturnDateEnabled,
  normalizeFmlaReturnDate,
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
})

