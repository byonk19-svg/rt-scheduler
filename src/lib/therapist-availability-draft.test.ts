import { describe, expect, it } from 'vitest'

import {
  buildCanWorkDates,
  buildCannotWorkDates,
  buildCycleDays,
  buildDaysWithNoteText,
  buildInitialNotesByDate,
  buildInitialStatusByDate,
  buildNotesPayload,
  chunkCycleWeeks,
  countAvailableDays,
  hasDraftAvailabilityChanges,
} from '@/lib/therapist-availability-draft'

describe('therapist availability draft helpers', () => {
  const rows = [
    {
      cycleId: 'cycle-1',
      date: '2026-03-24',
      entryType: 'force_off' as const,
      reason: 'Vacation',
    },
    {
      cycleId: 'cycle-1',
      date: '2026-03-25',
      entryType: 'force_on' as const,
      reason: 'Can cover late',
    },
  ]

  it('builds initial status and notes by date', () => {
    expect(buildInitialStatusByDate(rows)).toEqual({
      '2026-03-24': 'force_off',
      '2026-03-25': 'force_on',
    })
    expect(buildInitialNotesByDate(rows)).toEqual({
      '2026-03-24': 'Vacation',
      '2026-03-25': 'Can cover late',
    })
  })

  it('builds cycle days and chunks them into weeks', () => {
    const days = buildCycleDays({
      start_date: '2026-03-22',
      end_date: '2026-04-04',
    })

    expect(days).toHaveLength(14)
    expect(chunkCycleWeeks(days)).toHaveLength(2)
  })

  it('builds can-work, cannot-work, and notes payload values', () => {
    const draftStatusByDate = {
      '2026-03-24': 'force_off' as const,
      '2026-03-25': 'force_on' as const,
      '2026-03-26': 'none' as const,
    }
    const draftNotesByDate = {
      '2026-03-24': 'Vacation',
      '2026-03-25': 'Can cover late',
      '2026-03-26': 'Should not persist',
    }

    expect(buildCanWorkDates(draftStatusByDate)).toEqual(['2026-03-25'])
    expect(buildCannotWorkDates(draftStatusByDate)).toEqual(['2026-03-24'])
    expect(
      buildDaysWithNoteText({
        cycleDays: ['2026-03-24', '2026-03-25', '2026-03-26'],
        draftNotesByDate,
        draftStatusByDate,
      })
    ).toEqual(['2026-03-24', '2026-03-25'])
    expect(buildNotesPayload({ draftNotesByDate, draftStatusByDate })).toBe(
      '{"2026-03-24":"Vacation","2026-03-25":"Can cover late"}'
    )
  })

  it('counts available days and detects draft changes', () => {
    const cycleDays = ['2026-03-24', '2026-03-25', '2026-03-26']
    const initialStatusByDate = { '2026-03-24': 'force_off' as const }
    const draftStatusByDate = {
      '2026-03-24': 'force_off' as const,
      '2026-03-25': 'force_on' as const,
    }

    expect(
      countAvailableDays({
        cycleDays,
        draftStatusByDate,
        selectedCycle: { start_date: '2026-03-22', end_date: '2026-04-04' },
      })
    ).toBe(1)
    expect(
      hasDraftAvailabilityChanges({
        initialStatusByDate,
        draftStatusByDate,
        initialNotesByDate: {},
        draftNotesByDate: {},
      })
    ).toBe(true)
  })
})
