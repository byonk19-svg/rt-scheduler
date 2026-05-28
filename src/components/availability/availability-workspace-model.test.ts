import { describe, expect, it } from 'vitest'

import {
  applyOverrideToDraft,
  applySelectionToDraft,
  buildAvailabilityDraftSummary,
  buildCopiedCycleDraft,
  buildCycleDays,
  buildNotesMap,
  buildRangeDates,
  buildStatusMap,
  buildTherapistAvailabilityDayLabel,
  clearAvailabilityDraft,
  getDisplayState,
  hasAvailabilityDayDraftChanges,
  hasAvailabilityDraftChanges,
  updateDraftNote,
} from '@/components/availability/availability-workspace-model'

const baseline = {
  '2026-05-03': { baselineStatus: 'available' },
  '2026-05-04': { baselineStatus: 'off' },
  '2026-05-05': { baselineStatus: 'neutral' },
} as const

describe('availability workspace model', () => {
  it('builds editable draft state from existing availability rows', () => {
    const rows = [
      {
        cycleId: 'cycle-1',
        date: '2026-05-04',
        entryType: 'force_off',
        reason: 'Appointment',
        shiftType: 'both',
      },
      {
        cycleId: 'cycle-1',
        date: '2026-05-05',
        entryType: 'force_on',
        reason: '  ',
        shiftType: 'both',
      },
    ] as const

    expect(buildStatusMap(rows)).toEqual({
      '2026-05-04': 'force_off',
      '2026-05-05': 'force_on',
    })
    expect(buildNotesMap(rows)).toEqual({ '2026-05-04': 'Appointment' })
  })

  it('derives display state from recurring baseline plus one-off overrides', () => {
    expect(getDisplayState('2026-05-03', {}, baseline)).toBe('normal_work')
    expect(getDisplayState('2026-05-04', {}, baseline)).toBe('normal_off')
    expect(getDisplayState('2026-05-05', {}, baseline)).toBe('not_set')
    expect(getDisplayState('2026-05-04', { '2026-05-04': 'force_on' }, baseline)).toBe('can_work')
    expect(getDisplayState('2026-05-03', { '2026-05-03': 'force_off' }, baseline)).toBe(
      'cannot_work'
    )
  })

  it('normalizes one-off overrides that match the recurring baseline', () => {
    const draft = applyOverrideToDraft({
      statusByDate: { '2026-05-03': 'force_off' },
      notesByDate: { '2026-05-03': 'Old note' },
      date: '2026-05-03',
      status: 'force_on',
      baselineByDate: baseline,
    })

    expect(draft.statusByDate).toEqual({})
    expect(draft.notesByDate).toEqual({})
  })

  it('applies and removes availability blocks across a date range', () => {
    const dates = buildRangeDates(
      buildCycleDays({ start_date: '2026-05-03', end_date: '2026-05-09' }),
      '2026-05-05',
      '2026-05-03'
    )

    const applied = applySelectionToDraft({
      statusByDate: {},
      notesByDate: {},
      dates,
      status: 'force_off',
      baselineByDate: baseline,
    })

    expect(applied.statusByDate).toEqual({
      '2026-05-03': 'force_off',
      '2026-05-05': 'force_off',
    })

    const removed = applySelectionToDraft({
      ...applied,
      dates: ['2026-05-03'],
      status: null,
      baselineByDate: baseline,
    })

    expect(removed.statusByDate).toEqual({ '2026-05-05': 'force_off' })
  })

  it('tracks dirty state, note edits, reset, and submission payload summaries', () => {
    const initialStatus = { '2026-05-04': 'force_off' } as const
    const initialNotes = { '2026-05-04': 'Appointment' } as const
    const draftNotes = updateDraftNote(initialNotes, '2026-05-04', 'Appointment updated')

    expect(
      hasAvailabilityDraftChanges(initialStatus, initialStatus, initialNotes, draftNotes)
    ).toBe(true)

    const summary = buildAvailabilityDraftSummary({
      statusByDate: {
        '2026-05-03': 'force_on',
        '2026-05-04': 'force_off',
      },
      notesByDate: {
        '2026-05-03': 'Extra shift',
        '2026-05-04': 'Appointment updated',
        '2026-05-05': 'Ignored without status',
      },
    })

    expect(summary.canWorkDates).toEqual(['2026-05-03'])
    expect(summary.cannotWorkDates).toEqual(['2026-05-04'])
    expect(summary.notesPayload).toBe(
      JSON.stringify({
        '2026-05-03': 'Extra shift',
        '2026-05-04': 'Appointment updated',
      })
    )
    expect(clearAvailabilityDraft()).toEqual({ statusByDate: {}, notesByDate: {} })
  })

  it('builds therapist day labels with state, draft, selected, and locked context', () => {
    expect(
      buildTherapistAvailabilityDayLabel({
        dateLabel: 'May 3, 2026',
        displayState: 'normal_work',
        hasUnsavedChanges: false,
        isLocked: false,
        isSelected: false,
        isSubmitted: false,
      })
    ).toBe(
      'May 3, 2026. Normal schedule: Need to Work. No Schedule Block exception. Response not submitted. Editable; select to review or change'
    )

    expect(
      buildTherapistAvailabilityDayLabel({
        dateLabel: 'May 4, 2026',
        displayState: 'cannot_work',
        hasUnsavedChanges: true,
        isLocked: true,
        isSelected: true,
        isSubmitted: true,
      })
    ).toBe(
      'May 4, 2026. Schedule Block exception: Need Off. Unsaved draft changes. Selected day. Submitted response. Read-only because availability is locked'
    )
  })

  it('detects per-day draft changes for staff availability labels', () => {
    expect(
      hasAvailabilityDayDraftChanges({
        date: '2026-05-04',
        initialStatusByDate: { '2026-05-04': 'force_off' },
        draftStatusByDate: { '2026-05-04': 'force_off' },
        initialNotesByDate: { '2026-05-04': 'Appointment' },
        draftNotesByDate: { '2026-05-04': '  Appointment  ' },
      })
    ).toBe(false)

    expect(
      hasAvailabilityDayDraftChanges({
        date: '2026-05-04',
        initialStatusByDate: { '2026-05-04': 'force_off' },
        draftStatusByDate: {},
        initialNotesByDate: { '2026-05-04': 'Appointment' },
        draftNotesByDate: {},
      })
    ).toBe(true)
  })

  it('does not mark the draft dirty when notes only differ by surrounding whitespace', () => {
    expect(
      hasAvailabilityDraftChanges(
        { '2026-05-04': 'force_off' },
        { '2026-05-04': 'force_off' },
        { '2026-05-04': 'Appointment' },
        { '2026-05-04': '  Appointment  ' }
      )
    ).toBe(false)
  })

  it('sorts multiple Need to Work and Need Off dates in the submission summary', () => {
    const summary = buildAvailabilityDraftSummary({
      statusByDate: {
        '2026-05-07': 'force_off',
        '2026-05-03': 'force_on',
        '2026-05-06': 'force_on',
        '2026-05-04': 'force_off',
      },
      notesByDate: {
        '2026-05-07': 'Late appointment',
        '2026-05-03': 'Extra day',
        '2026-05-06': 'Can cover',
        '2026-05-04': 'School event',
      },
    })

    expect(summary.canWorkDates).toEqual(['2026-05-03', '2026-05-06'])
    expect(summary.cannotWorkDates).toEqual(['2026-05-04', '2026-05-07'])
    expect(summary.notesPayload).toBe(
      JSON.stringify({
        '2026-05-07': 'Late appointment',
        '2026-05-03': 'Extra day',
        '2026-05-06': 'Can cover',
        '2026-05-04': 'School event',
      })
    )
  })

  it('copies previous cycle overrides into the selected cycle while respecting the baseline', () => {
    const copied = buildCopiedCycleDraft({
      cycles: [
        {
          id: 'cycle-old',
          start_date: '2026-04-05',
          end_date: '2026-04-11',
        },
        {
          id: 'cycle-new',
          start_date: '2026-05-03',
          end_date: '2026-05-09',
        },
      ],
      availabilityRows: [
        {
          cycleId: 'cycle-old',
          date: '2026-04-05',
          entryType: 'force_on',
          reason: 'Matches baseline',
          shiftType: 'both',
        },
        {
          cycleId: 'cycle-old',
          date: '2026-04-07',
          entryType: 'force_off',
          reason: 'Vacation',
          shiftType: 'both',
        },
      ],
      selectedCycleId: 'cycle-new',
      baselineByDate: baseline,
    })

    expect(copied).toEqual({
      statusByDate: { '2026-05-05': 'force_off' },
      notesByDate: { '2026-05-05': 'Vacation' },
    })
  })

  it('clears copied draft overrides when the previous cycle has no overrides', () => {
    const copied = buildCopiedCycleDraft({
      cycles: [
        {
          id: 'cycle-old',
          start_date: '2026-04-05',
          end_date: '2026-04-11',
        },
        {
          id: 'cycle-new',
          start_date: '2026-05-03',
          end_date: '2026-05-09',
        },
      ],
      availabilityRows: [
        {
          cycleId: 'other-cycle',
          date: '2026-04-05',
          entryType: 'force_off',
          reason: 'Not the source cycle',
          shiftType: 'both',
        },
      ],
      selectedCycleId: 'cycle-new',
      baselineByDate: baseline,
    })

    expect(copied).toEqual({ statusByDate: {}, notesByDate: {} })
  })

  it('drops copied overrides that match the selected cycle recurring baseline', () => {
    const copied = buildCopiedCycleDraft({
      cycles: [
        {
          id: 'cycle-old',
          start_date: '2026-04-05',
          end_date: '2026-04-11',
        },
        {
          id: 'cycle-new',
          start_date: '2026-05-03',
          end_date: '2026-05-09',
        },
      ],
      availabilityRows: [
        {
          cycleId: 'cycle-old',
          date: '2026-04-05',
          entryType: 'force_on',
          reason: 'Already normal work',
          shiftType: 'both',
        },
        {
          cycleId: 'cycle-old',
          date: '2026-04-06',
          entryType: 'force_off',
          reason: 'Already normal off',
          shiftType: 'both',
        },
      ],
      selectedCycleId: 'cycle-new',
      baselineByDate: {
        '2026-05-03': { baselineStatus: 'available' },
        '2026-05-04': { baselineStatus: 'off' },
      },
    })

    expect(copied).toEqual({ statusByDate: {}, notesByDate: {} })
  })

  it('leaves the draft unchanged when there is no previous cycle to copy', () => {
    const copied = buildCopiedCycleDraft({
      cycles: [
        {
          id: 'cycle-first',
          start_date: '2026-05-03',
          end_date: '2026-05-09',
        },
      ],
      availabilityRows: [],
      selectedCycleId: 'cycle-first',
      baselineByDate: baseline,
    })

    expect(copied).toBeNull()
  })

  it('leaves the draft unchanged when the selected cycle is missing', () => {
    const copied = buildCopiedCycleDraft({
      cycles: [
        {
          id: 'cycle-first',
          start_date: '2026-05-03',
          end_date: '2026-05-09',
        },
      ],
      availabilityRows: [],
      selectedCycleId: 'missing-cycle',
      baselineByDate: baseline,
    })

    expect(copied).toBeNull()
  })
})
