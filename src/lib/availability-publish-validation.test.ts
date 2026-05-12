import { describe, expect, it } from 'vitest'

import { summarizeAvailabilityPublishIssues } from '@/lib/availability-publish-validation'

describe('availability publish validation', () => {
  it('blocks missed Need to Work entries', () => {
    const summary = summarizeAvailabilityPublishIssues({
      overrides: [
        {
          therapist_id: 'therapist-1',
          cycle_id: 'cycle-1',
          date: '2026-04-12',
          shift_type: 'day',
          override_type: 'force_on',
          source: 'therapist',
        },
      ],
      scheduledShifts: [],
    })

    expect(summary.needToWorkMisses).toBe(1)
  })

  it('requires manager context when publishing over Need Off', () => {
    const summary = summarizeAvailabilityPublishIssues({
      overrides: [
        {
          therapist_id: 'therapist-1',
          cycle_id: 'cycle-1',
          date: '2026-04-12',
          shift_type: 'both',
          override_type: 'force_off',
          source: 'therapist',
        },
      ],
      scheduledShifts: [
        {
          user_id: 'therapist-1',
          date: '2026-04-12',
          shift_type: 'night',
          status: 'scheduled',
          availability_override: false,
          availability_override_reason: null,
          availability_override_by: null,
          availability_override_at: null,
        },
      ],
    })

    expect(summary.needOffOverridesMissingReason).toBe(1)
  })

  it('accepts Need Off overrides with manager attribution', () => {
    const summary = summarizeAvailabilityPublishIssues({
      overrides: [
        {
          therapist_id: 'therapist-1',
          cycle_id: 'cycle-1',
          date: '2026-04-12',
          shift_type: 'day',
          override_type: 'force_off',
          source: 'therapist',
        },
      ],
      scheduledShifts: [
        {
          user_id: 'therapist-1',
          date: '2026-04-12',
          shift_type: 'day',
          status: 'scheduled',
          availability_override: true,
          availability_override_reason: 'Manager confirmed by email.',
          availability_override_by: 'manager-1',
          availability_override_at: '2026-04-01T12:00:00.000Z',
        },
      ],
    })

    expect(summary.needOffOverridesMissingReason).toBe(0)
  })

  it('counts missing availability only when no submission or manager-entered availability exists', () => {
    const summary = summarizeAvailabilityPublishIssues({
      overrides: [
        {
          therapist_id: 'therapist-2',
          cycle_id: 'cycle-1',
          date: '2026-04-12',
          shift_type: 'day',
          override_type: 'force_on',
          source: 'manager',
        },
      ],
      scheduledShifts: [
        {
          user_id: 'therapist-2',
          date: '2026-04-12',
          shift_type: 'day',
          status: 'scheduled',
        },
      ],
      expectedTherapistIds: ['therapist-1', 'therapist-2', 'therapist-3'],
      submittedTherapistIds: ['therapist-1'],
    })

    expect(summary.missingAvailabilitySubmissions).toBe(1)
  })
})
