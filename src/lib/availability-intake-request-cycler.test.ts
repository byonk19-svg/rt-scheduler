import { describe, expect, it } from 'vitest'

import type { ParsedAvailabilityRequest } from '@/lib/availability-email-intake'
import {
  cycleIntakeRequest,
  markRequestsEdited,
  removeIntakeRequest,
} from '@/lib/availability-intake-request-cycler'

function buildRequest(overrides?: Partial<ParsedAvailabilityRequest>): ParsedAvailabilityRequest {
  return {
    date: '2026-03-24',
    override_type: 'force_off',
    shift_type: 'both',
    note: null,
    source_line: 'Need off Mar 24',
    ...overrides,
  }
}

describe('cycleIntakeRequest', () => {
  it('cycles a date between force_off and force_on without dropping the row', () => {
    const forceOn = cycleIntakeRequest({
      requests: [buildRequest()],
      target: {
        date: '2026-03-24',
        override_type: 'force_off',
        shift_type: 'both',
      },
    })

    expect(forceOn).toEqual([
      buildRequest({
        override_type: 'force_on',
      }),
    ])

    const backToOff = cycleIntakeRequest({
      requests: forceOn,
      target: {
        date: '2026-03-24',
        override_type: 'force_on',
        shift_type: 'both',
      },
    })

    expect(backToOff).toEqual([buildRequest()])
  })

  it('adds a missing date as a force_off request using the sanitized request shape', () => {
    expect(
      cycleIntakeRequest({
        requests: [],
        target: {
          date: '2026-03-25',
          override_type: 'force_off',
          shift_type: 'both',
        },
      })
    ).toEqual([
      {
        date: '2026-03-25',
        override_type: 'force_off',
        shift_type: 'both',
        note: null,
        source_line: 'Imported email',
      },
    ])
  })

  it('returns requests in deterministic date order after cycling', () => {
    expect(
      cycleIntakeRequest({
        requests: [
          buildRequest({
            date: '2026-03-26',
            source_line: 'Need off Mar 26',
          }),
        ],
        target: {
          date: '2026-03-24',
          override_type: 'force_off',
          shift_type: 'both',
        },
      })
    ).toEqual([
      {
        date: '2026-03-24',
        override_type: 'force_off',
        shift_type: 'both',
        note: null,
        source_line: 'Imported email',
      },
      buildRequest({
        date: '2026-03-26',
        source_line: 'Need off Mar 26',
      }),
    ])
  })

  it('cycles one same-day chip without deleting a same-day sibling request', () => {
    expect(
      cycleIntakeRequest({
        requests: [
          buildRequest({
            date: '2026-03-24',
            override_type: 'force_off',
            shift_type: 'both',
            source_line: 'Need off Mar 24',
          }),
          buildRequest({
            date: '2026-03-24',
            override_type: 'force_on',
            shift_type: 'day',
            source_line: 'Can work Mar 24 day',
          }),
        ],
        target: {
          date: '2026-03-24',
          override_type: 'force_off',
          shift_type: 'both',
        },
      })
    ).toEqual([
      {
        date: '2026-03-24',
        override_type: 'force_on',
        shift_type: 'both',
        note: null,
        source_line: 'Need off Mar 24',
      },
      {
        date: '2026-03-24',
        override_type: 'force_on',
        shift_type: 'day',
        note: null,
        source_line: 'Can work Mar 24 day',
      },
    ])
  })

  it('removeIntakeRequest drops only the matching chip', () => {
    expect(
      removeIntakeRequest({
        requests: [
          buildRequest({ date: '2026-03-24', source_line: 'A' }),
          buildRequest({
            date: '2026-03-25',
            override_type: 'force_on',
            source_line: 'B',
          }),
        ],
        target: {
          date: '2026-03-24',
          override_type: 'force_off',
          shift_type: 'both',
        },
      })
    ).toEqual([
      buildRequest({
        date: '2026-03-25',
        override_type: 'force_on',
        source_line: 'B',
      }),
    ])
  })

  it('ignores attempts to create a new request from an invalid raw date', () => {
    expect(
      cycleIntakeRequest({
        requests: [],
        target: {
          date: 'not-a-date',
          override_type: 'force_off',
          shift_type: 'both',
        },
      })
    ).toEqual([])
  })
})

describe('markRequestsEdited', () => {
  it('returns false when current requests normalize to the same parsed output', () => {
    expect(
      markRequestsEdited({
        originalRequests: [
          buildRequest({
            date: '2026-03-24',
          }),
          buildRequest({
            date: '2026-03-26',
            override_type: 'force_on',
            source_line: 'Can work Mar 26',
          }),
        ],
        currentRequests: [
          buildRequest({
            date: '2026-03-26',
            override_type: 'force_on',
            source_line: 'Can work Mar 26',
          }),
          {
            date: 'bad-date',
            override_type: 'force_off',
            shift_type: 'both',
            note: null,
            source_line: 'bad',
          },
          buildRequest({
            date: '2026-03-24',
          }),
        ],
      })
    ).toBe(false)
  })

  it('returns true when a request override changes from the original parsed output', () => {
    expect(
      markRequestsEdited({
        originalRequests: [buildRequest()],
        currentRequests: [
          buildRequest({
            override_type: 'force_on',
          }),
        ],
      })
    ).toBe(true)
  })
})
