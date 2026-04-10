import { describe, expect, it } from 'vitest'

import {
  parseAvailabilityEmail,
  parseSender,
  sanitizeParsedRequests,
  stripHtmlToText,
} from '@/lib/availability-email-intake'

const cycles = [
  {
    id: 'cycle-1',
    label: 'Block 1',
    start_date: '2026-03-22',
    end_date: '2026-05-02',
  },
]

describe('parseAvailabilityEmail', () => {
  it('parses off and work lines into structured requests', () => {
    const parsed = parseAvailabilityEmail(
      ['Need off Mar 24, Mar 26', 'Can work Mar 28'].join('\n'),
      cycles
    )

    expect(parsed.status).toBe('parsed')
    expect(parsed.matchedCycleId).toBe('cycle-1')
    expect(parsed.requests).toEqual([
      {
        date: '2026-03-24',
        override_type: 'force_off',
        shift_type: 'both',
        note: null,
        source_line: 'Need off Mar 24, Mar 26',
      },
      {
        date: '2026-03-26',
        override_type: 'force_off',
        shift_type: 'both',
        note: null,
        source_line: 'Need off Mar 24, Mar 26',
      },
      {
        date: '2026-03-28',
        override_type: 'force_on',
        shift_type: 'both',
        note: null,
        source_line: 'Can work Mar 28',
      },
    ])
  })

  it('flags lines that contain request language but no resolvable dates', () => {
    const parsed = parseAvailabilityEmail('Need off next Friday', cycles)

    expect(parsed.status).toBe('failed')
    expect(parsed.requests).toEqual([])
    expect(parsed.unresolvedLines).toEqual(['Need off next Friday'])
  })
})

describe('availability email helpers', () => {
  it('extracts sender name and email', () => {
    expect(parseSender('Ava Brown <ava@example.com>')).toEqual({
      email: 'ava@example.com',
      name: 'Ava Brown',
    })
  })

  it('strips basic html to text', () => {
    expect(stripHtmlToText('<p>Need off <strong>Mar 24</strong></p>')).toBe('Need off Mar 24')
  })

  it('sanitizes persisted parsed request payloads', () => {
    expect(
      sanitizeParsedRequests([
        {
          date: '2026-03-24',
          override_type: 'force_off',
          shift_type: 'both',
          note: '',
          source_line: 'Need off Mar 24',
        },
        {
          date: 'bad-date',
          override_type: 'force_off',
          shift_type: 'both',
          source_line: 'bad',
        },
      ])
    ).toEqual([
      {
        date: '2026-03-24',
        override_type: 'force_off',
        shift_type: 'both',
        note: null,
        source_line: 'Need off Mar 24',
      },
    ])
  })
})
