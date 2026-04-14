import { describe, expect, it } from 'vitest'

import {
  parseAvailabilityEmail,
  parseAvailabilityEmailItem,
  parseSender,
  sanitizeParsedRequests,
  summarizeAvailabilityEmailBatch,
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

  it('splits mixed off/work sentences into separate intent segments', () => {
    const parsed = parseAvailabilityEmail('Need off Apr 14, Apr 16 Can work Apr 18', cycles)

    expect(parsed.requests).toEqual([
      {
        date: '2026-04-14',
        override_type: 'force_off',
        shift_type: 'both',
        note: null,
        source_line: 'Need off Apr 14, Apr 16',
      },
      {
        date: '2026-04-16',
        override_type: 'force_off',
        shift_type: 'both',
        note: null,
        source_line: 'Need off Apr 14, Apr 16',
      },
      {
        date: '2026-04-18',
        override_type: 'force_on',
        shift_type: 'both',
        note: null,
        source_line: 'Can work Apr 18',
      },
    ])
  })

  it('parses lines where the date appears before the request intent', () => {
    const parsed = parseAvailabilityEmail('Sunday 11/4/24 - need off for dr. appt', cycles)

    expect(parsed.requests).toEqual([
      {
        date: '2024-11-04',
        override_type: 'force_off',
        shift_type: 'both',
        note: null,
        source_line: 'Sunday 11/4/24 - need off for dr. appt',
      },
    ])
  })
})

describe('parseAvailabilityEmailItem', () => {
  const profiles = [
    { id: 'therapist-1', full_name: 'Brianna Brown', is_active: true },
    { id: 'therapist-2', full_name: 'Brian Brown', is_active: true },
  ]

  it('parses a PTO-style item and marks it parsed when employee and cycle match cleanly', () => {
    expect(
      parseAvailabilityEmailItem({
        sourceType: 'attachment',
        sourceLabel: 'form-1.jpg',
        rawText: 'Employee Name: Brianna Brown\nPTO request\nNeed off Mar 24 and Mar 26',
        cycles,
        profiles,
      })
    ).toMatchObject({
      sourceType: 'attachment',
      sourceLabel: 'form-1.jpg',
      extractedEmployeeName: 'Brianna Brown',
      matchedTherapistId: 'therapist-1',
      matchedCycleId: 'cycle-1',
      parseStatus: 'parsed',
      confidenceLevel: 'high',
      confidenceReasons: [],
    })
  })

  it('marks an item needs_review when dates parse but the employee match is ambiguous', () => {
    expect(
      parseAvailabilityEmailItem({
        sourceType: 'body',
        sourceLabel: 'Email body',
        rawText: 'Employee Name: Brown\nNeed off Mar 24',
        cycles,
        profiles,
      })
    ).toMatchObject({
      parseStatus: 'needs_review',
      confidenceLevel: 'medium',
      confidenceReasons: expect.arrayContaining(['employee_match_ambiguous']),
    })
  })

  it('ignores forwarded email header lines in body text', () => {
    expect(
      parseAvailabilityEmailItem({
        sourceType: 'body',
        sourceLabel: 'Email body',
        rawText:
          'work>Sent: Monday, April 13, 2026 at 02:53:53 PM CDTSubject:\nFrom: byonkin19@yahoo.com',
        cycles,
        profiles,
      })
    ).toMatchObject({
      parseStatus: 'failed',
      requests: [],
      extractedEmployeeName: null,
    })
  })
})

describe('summarizeAvailabilityEmailBatch', () => {
  it('summarizes parsed and review items by count', () => {
    expect(
      summarizeAvailabilityEmailBatch([
        {
          sourceType: 'body',
          sourceLabel: 'Email body',
          extractedEmployeeName: 'Brianna Brown',
          employeeMatchCandidates: [{ id: 'therapist-1', fullName: 'Brianna Brown' }],
          matchedTherapistId: 'therapist-1',
          matchedCycleId: 'cycle-1',
          parseStatus: 'parsed',
          confidenceLevel: 'high',
          confidenceReasons: [],
          requests: [],
          unresolvedLines: [],
          rawText: 'Need off Mar 24',
        },
        {
          sourceType: 'attachment',
          sourceLabel: 'form-1.jpg',
          extractedEmployeeName: null,
          employeeMatchCandidates: [],
          matchedTherapistId: null,
          matchedCycleId: null,
          parseStatus: 'needs_review',
          confidenceLevel: 'medium',
          confidenceReasons: ['employee_match_ambiguous'],
          requests: [],
          unresolvedLines: [],
          rawText: '',
        },
      ]).summary
    ).toBe('2 items | 1 parsed | 1 need review | 0 failed')
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
