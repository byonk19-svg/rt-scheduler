import { describe, expect, it } from 'vitest'

import {
  buildTherapistSubmissionUiState,
  resolveAvailabilityDueSupportLine,
  resolveTherapistDeadlinePresentation,
  shouldShowLastEditedAfterSubmit,
} from '@/lib/therapist-availability-submission'

describe('therapist-availability-submission', () => {
  it('treats missing submission row as not submitted', () => {
    expect(buildTherapistSubmissionUiState(null)).toEqual({
      isSubmitted: false,
      submittedAtDisplay: null,
      lastEditedDisplay: null,
    })
  })

  it('builds submitted display without last edited when timestamps match', () => {
    const iso = '2026-04-07T15:42:00.000Z'
    const ui = buildTherapistSubmissionUiState({
      schedule_cycle_id: 'c1',
      submitted_at: iso,
      last_edited_at: iso,
    })
    expect(ui.isSubmitted).toBe(true)
    expect(ui.submittedAtDisplay).toMatch(/Apr/)
    expect(ui.lastEditedDisplay).toBeNull()
  })

  it('shows last edited only when meaningfully after submitted_at', () => {
    expect(
      shouldShowLastEditedAfterSubmit('2026-04-07T15:42:00.000Z', '2026-04-07T15:42:01.000Z')
    ).toBe(false)
    expect(
      shouldShowLastEditedAfterSubmit('2026-04-07T15:42:00.000Z', '2026-04-08T14:10:00.000Z')
    ).toBe(true)
  })

  it('uses explicit availability_due_at in due-date wording when not imminent', () => {
    const line = resolveAvailabilityDueSupportLine(
      { start_date: '2026-04-01', availability_due_at: '2026-04-10T23:59:59.000Z' },
      false,
      new Date(2026, 3, 7, 12, 0, 0)
    )
    expect(line).toBe('Due Apr 10, 2026')
  })

  it('falls back to day-before-start when availability_due_at is absent', () => {
    const line = resolveAvailabilityDueSupportLine(
      { start_date: '2026-04-15' },
      false,
      new Date(2026, 3, 7, 12, 0, 0)
    )
    expect(line).toBe('Due Apr 14, 2026')
  })

  it('returns null for due line when submitted', () => {
    expect(
      resolveAvailabilityDueSupportLine(
        { start_date: '2026-04-01', availability_due_at: null },
        true,
        new Date(2026, 3, 7, 12, 0, 0)
      )
    ).toBeNull()
  })

  it('returns Past due when the soft deadline day has ended', () => {
    const line = resolveAvailabilityDueSupportLine(
      { start_date: '2026-03-01' },
      false,
      new Date(2026, 3, 7, 12, 0, 0)
    )
    expect(line).toBe('Past due — final deadline was Feb 28, 2026')
  })

  it('returns Due tomorrow when the deadline is the next calendar day', () => {
    const line = resolveAvailabilityDueSupportLine(
      { start_date: '2026-04-15', availability_due_at: '2026-04-10T23:59:59.000Z' },
      false,
      new Date(2026, 3, 9, 12, 0, 0)
    )
    expect(line).toBe('Due tomorrow')
  })

  it('returns Due today when the deadline is today', () => {
    const line = resolveAvailabilityDueSupportLine(
      { start_date: '2026-04-15', availability_due_at: '2026-04-10T23:59:59.000Z' },
      false,
      new Date(2026, 3, 10, 10, 0, 0)
    )
    expect(line).toBe('Due today')
  })

  it('treats explicit deadline as past only after the instant has passed', () => {
    const before = resolveAvailabilityDueSupportLine(
      { start_date: '2026-04-01', availability_due_at: '2026-04-10T18:00:00.000Z' },
      false,
      new Date('2026-04-10T17:59:59.000Z')
    )
    const after = resolveAvailabilityDueSupportLine(
      { start_date: '2026-04-01', availability_due_at: '2026-04-10T18:00:00.000Z' },
      false,
      new Date('2026-04-10T18:00:01.000Z')
    )
    expect(before).not.toMatch(/^Past due/)
    expect(after).toMatch(/^Past due — final deadline was /)
  })

  it('includes submitted lines and final deadline context when submitted', () => {
    const ui = buildTherapistSubmissionUiState({
      schedule_cycle_id: 'c1',
      submitted_at: '2026-04-08T15:40:00.000Z',
      last_edited_at: '2026-04-08T15:40:00.000Z',
    })
    const pres = resolveTherapistDeadlinePresentation(
      { start_date: '2026-04-15', availability_due_at: '2026-04-10T12:00:00.000Z' },
      ui,
      new Date(2026, 3, 12, 12, 0, 0)
    )
    expect(pres.deadlineHeadline).toBeNull()
    expect(pres.submittedPrimaryLine).toMatch(/^Submitted /)
    expect(pres.submittedPrimaryLine).toMatch(/Apr/)
    expect(pres.submittedDeadlineContextLine).toMatch(/^Final deadline was /)
    expect(pres.emphasis).toBe('submitted')
  })
})
