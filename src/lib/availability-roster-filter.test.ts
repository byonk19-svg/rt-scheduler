import { describe, expect, it } from 'vitest'

import { resolveAvailabilityRosterFilter } from '@/lib/availability-roster-filter'

describe('resolveAvailabilityRosterFilter', () => {
  const submittedRows = [
    {
      therapistId: 'submitted-with-requests',
      therapistName: 'Submitted Requests',
      overridesCount: 1,
      managerEnteredCount: 0,
      lastUpdatedAt: '2026-07-01T12:00:00.000Z',
    },
    {
      therapistId: 'submitted-clean',
      therapistName: 'Submitted Clean',
      overridesCount: 0,
      managerEnteredCount: 0,
      lastUpdatedAt: '2026-07-01T12:00:00.000Z',
    },
  ]
  const missingRows = [
    {
      therapistId: 'missing',
      therapistName: 'Missing Therapist',
      overridesCount: 0,
      lastUpdatedAt: null,
    },
  ]

  it('honors an explicit valid roster filter', () => {
    expect(
      resolveAvailabilityRosterFilter({
        requestedFilter: 'all',
        selectedTherapistId: 'submitted-with-requests',
        submittedRows,
        missingRows,
      })
    ).toBe('all')
  })

  it('deep-links submitted therapists with requests into the review bucket', () => {
    expect(
      resolveAvailabilityRosterFilter({
        selectedTherapistId: 'submitted-with-requests',
        submittedRows,
        missingRows,
      })
    ).toBe('submitted_with_exceptions')
  })

  it('deep-links submitted therapists without requests into the no-request bucket', () => {
    expect(
      resolveAvailabilityRosterFilter({
        selectedTherapistId: 'submitted-clean',
        submittedRows,
        missingRows,
      })
    ).toBe('submitted_no_exceptions')
  })

  it('keeps missing therapists in the missing bucket', () => {
    expect(
      resolveAvailabilityRosterFilter({
        selectedTherapistId: 'missing',
        submittedRows,
        missingRows,
      })
    ).toBe('missing')
  })
})
