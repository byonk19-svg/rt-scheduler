import { describe, expect, it } from 'vitest'

import {
  parseAvailabilityEmail,
  parseAvailabilityEmailBatchSources,
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

const ptoCycles = [
  {
    id: 'cycle-pto',
    label: 'May Block',
    start_date: '2026-05-03',
    end_date: '2026-06-13',
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

  it('treats bare PTO-form dates as off requests and ignores the signed-date footer', () => {
    const profiles = [{ id: 'therapist-1', full_name: 'Brianna Yonkin', is_active: true }]

    expect(
      parseAvailabilityEmailItem({
        sourceType: 'attachment',
        sourceLabel: 'pto-form.txt',
        rawText: [
          'Employee Name: Brianna Yonkin',
          'Department: Resp.',
          'Date PTO Hours LT Sick Hours Jury Hours Bereavement Hours',
          '5/10',
          '5/16',
          '6/6',
          '5/24',
          'Employee Signature: Brianna Yonkin',
          'Date: 4/8/26',
        ].join('\n'),
        cycles: ptoCycles,
        profiles,
      })
    ).toMatchObject({
      extractedEmployeeName: 'Brianna Yonkin',
      matchedTherapistId: 'therapist-1',
      matchedCycleId: 'cycle-pto',
      requests: [
        expect.objectContaining({ date: '2026-05-10', override_type: 'force_off' }),
        expect.objectContaining({ date: '2026-05-16', override_type: 'force_off' }),
        expect.objectContaining({ date: '2026-05-24', override_type: 'force_off' }),
        expect.objectContaining({ date: '2026-06-06', override_type: 'force_off' }),
      ],
    })
  })

  it('expands PTO-form date ranges and keeps explicit work rows as work', () => {
    const profiles = [{ id: 'therapist-1', full_name: 'Ruth Guandique', is_active: true }]

    const parsed = parseAvailabilityEmailItem({
      sourceType: 'attachment',
      sourceLabel: 'pto-form.txt',
      rawText: [
        'Employee Name: Ruth Guandique',
        'Date PTO Hours LT Sick Hours Jury Hours Bereavement Hours',
        '5/3 - 5/5 off will work rest of week',
        '5/9 - 5/10 off',
        '5/14 working memorial',
        'Employee Signature: Ruth Guandique',
        'Date: 3/25/26',
      ].join('\n'),
      cycles: ptoCycles,
      profiles,
    })

    expect(parsed.requests).toEqual([
      expect.objectContaining({ date: '2026-05-03', override_type: 'force_off' }),
      expect.objectContaining({ date: '2026-05-04', override_type: 'force_off' }),
      expect.objectContaining({ date: '2026-05-05', override_type: 'force_off' }),
      expect.objectContaining({ date: '2026-05-09', override_type: 'force_off' }),
      expect.objectContaining({ date: '2026-05-10', override_type: 'force_off' }),
      expect.objectContaining({ date: '2026-05-14', override_type: 'force_on' }),
    ])
  })

  it('expands weekday recurrence within a handwritten PTO form window', () => {
    const profiles = [{ id: 'therapist-1', full_name: 'Kim Suarez', is_active: true }]

    const parsed = parseAvailabilityEmailItem({
      sourceType: 'attachment',
      sourceLabel: 'pto-form.txt',
      rawText: [
        'Employee Name: Kim Suarez',
        'Date PTO Hours LT Sick Hours Jury Hours Bereavement Hours',
        '(off Tuesday + Wednesdays written in pink ink)',
        'Handwritten note: May 3rd - June 13',
        'Signature: KSL',
        'Date: 4/6/26',
      ].join('\n'),
      cycles: ptoCycles,
      profiles,
    })

    expect(parsed.requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-05-05', override_type: 'force_off' }),
        expect.objectContaining({ date: '2026-05-06', override_type: 'force_off' }),
        expect.objectContaining({ date: '2026-06-09', override_type: 'force_off' }),
        expect.objectContaining({ date: '2026-06-10', override_type: 'force_off' }),
      ])
    )
  })
})

describe('parseAvailabilityEmailBatchSources', () => {
  it('splits one PTO-form email into separate employee items', () => {
    const result = parseAvailabilityEmailBatchSources({
      normalizedBodyText: [
        'PTO REQUEST/EDIT FORM',
        '',
        'Employee Name: Lynn Snow',
        'Date PTO Hours LT Sick Hours Jury Hours Bereavement Hours',
        'May 4th Dr. appointment',
        'Employee Signature: Lynn Snow',
        'Date: 2/10/26',
        '',
        '---',
        '',
        'Employee Name: Barbara Cummings',
        'Date PTO Hours LT Sick Hours Jury Hours Bereavement Hours',
        '5/10 WORK',
        '5/11 Work',
        'Employee Signature: B. Cummings',
        'Date: 2/18/26',
      ].join('\n'),
      attachments: [],
      cycles: ptoCycles,
      profiles: [
        { id: 'therapist-1', full_name: 'Lynn Snow', is_active: true },
        { id: 'therapist-2', full_name: 'Barbara Cummings', is_active: true },
      ],
      autoApplyHighConfidence: false,
    })

    expect(result.items).toHaveLength(2)
    expect(result.items.map((item) => item.extractedEmployeeName)).toEqual([
      'Lynn Snow',
      'Barbara Cummings',
    ])
    const lynnItem = result.items.find((item) => item.extractedEmployeeName === 'Lynn Snow')
    const barbaraItem = result.items.find(
      (item) => item.extractedEmployeeName === 'Barbara Cummings'
    )
    expect(lynnItem?.requests).toEqual([
      expect.objectContaining({ date: '2026-05-04', override_type: 'force_off' }),
    ])
    expect(barbaraItem?.requests).toEqual([
      expect.objectContaining({ date: '2026-05-10', override_type: 'force_on' }),
      expect.objectContaining({ date: '2026-05-11', override_type: 'force_on' }),
    ])
  })

  it('expands weekday recurrence across the active block and leaves OCR-broken fragments for review', () => {
    const result = parseAvailabilityEmailBatchSources({
      normalizedBodyText: [
        'Employee Name: Barbara Cummings',
        '5/10 WORK',
        '5/11 WORK',
        '5/12',
        '5 Sunday 5/ Back to work 25',
        '',
        'Employee Name: Kim Suarez',
        'Comments= Off Tuesday + Wednesdays',
        '',
        'Employee Name: Kim Suarez',
        'Comments= Off May 10th',
      ].join('\n'),
      attachments: [],
      cycles: ptoCycles,
      profiles: [
        { id: 'therapist-1', full_name: 'Barbara Cummings', is_active: true },
        { id: 'therapist-2', full_name: 'Kim Suarez', is_active: true },
      ],
      autoApplyHighConfidence: false,
    })

    expect(result.items).toHaveLength(2)

    const barbaraItem = result.items.find(
      (item) => item.extractedEmployeeName === 'Barbara Cummings'
    )
    const kimItem = result.items.find((item) => item.extractedEmployeeName === 'Kim Suarez')

    expect(barbaraItem).toMatchObject({
      parseStatus: 'needs_review',
      unresolvedLines: ['5 Sunday 5/ Back to work 25'],
      requests: [
        expect.objectContaining({ date: '2026-05-10', override_type: 'force_on' }),
        expect.objectContaining({ date: '2026-05-11', override_type: 'force_on' }),
        expect.objectContaining({ date: '2026-05-12', override_type: 'force_off' }),
      ],
    })
    expect(barbaraItem?.requests.some((request) => request.date === '2026-05-25')).toBe(false)

    expect(kimItem?.parseStatus).toBe('parsed')
    expect(kimItem?.requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-05-05', override_type: 'force_off' }),
        expect.objectContaining({ date: '2026-05-06', override_type: 'force_off' }),
        expect.objectContaining({ date: '2026-06-09', override_type: 'force_off' }),
        expect.objectContaining({ date: '2026-06-10', override_type: 'force_off' }),
        expect.objectContaining({ date: '2026-05-10', override_type: 'force_off' }),
      ])
    )
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
