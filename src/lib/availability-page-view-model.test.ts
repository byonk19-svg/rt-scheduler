import { describe, expect, it } from 'vitest'

import {
  buildAvailabilitySubmissionMap,
  buildManagerAvailabilitySummaryChips,
  buildManagerAvailabilityRosterViewModel,
  getTodayKey,
} from '@/lib/availability-page-view-model'

describe('availability-page-view-model', () => {
  it('builds a cycle submission map', () => {
    expect(
      buildAvailabilitySubmissionMap([
        {
          schedule_cycle_id: 'cycle-1',
          submitted_at: '2026-04-01T00:00:00.000Z',
          last_edited_at: '2026-04-02T00:00:00.000Z',
        },
      ])
    ).toEqual({
      'cycle-1': {
        submittedAt: '2026-04-01T00:00:00.000Z',
        lastEditedAt: '2026-04-02T00:00:00.000Z',
      },
    })
  })

  it('formats today keys deterministically', () => {
    expect(getTodayKey(new Date('2026-04-19T12:00:00.000Z'))).toBe('2026-04-19')
  })

  it('builds both official and response roster availability views', () => {
    const result = buildManagerAvailabilityRosterViewModel({
      therapists: [
        { id: 'ther-1', full_name: 'Aleyce' },
        { id: 'ther-2', full_name: 'Barbara' },
      ],
      entries: [
        {
          id: 'row-1',
          therapist_id: 'ther-1',
          cycle_id: 'cycle-1',
          date: '2026-04-19',
          shift_type: 'both',
          override_type: 'force_off',
          note: null,
          created_at: '2026-04-01T00:00:00.000Z',
          source: 'therapist',
        },
      ],
      selectedCycleId: 'cycle-1',
      officialSubmissionTherapistIds: new Set(['ther-1']),
    })

    expect(result.officiallySubmittedRows).toHaveLength(1)
    expect(result.awaitingOfficialSubmissionRows).toHaveLength(1)
    expect(result.responseRosterSubmittedRows).toHaveLength(1)
    expect(result.responseRosterMissingRows).toHaveLength(1)
  })

  it('builds manager summary chips with active states and hrefs', () => {
    const chips = buildManagerAvailabilitySummaryChips({
      awaitingOfficialSubmissionCount: 3,
      officiallySubmittedCount: 7,
      needOffRequests: 4,
      availableToWorkRequests: 2,
      initialRoster: 'missing',
      initialStatus: 'force_on',
      buildHref: (updates, hash) => `${JSON.stringify(updates)}${hash ?? ''}`,
    })

    expect(chips.map((chip) => chip.label)).toEqual([
      'Awaiting therapist submission',
      'Officially submitted',
      'Dates marked off',
      'Dates marked available',
    ])
    expect(chips[0]?.active).toBe(true)
    expect(chips[3]?.active).toBe(true)
  })
})
