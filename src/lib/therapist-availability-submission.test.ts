import { describe, expect, it } from 'vitest'

import {
  buildTherapistSubmissionUiState,
  resolveAvailabilityDueSupportLine,
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

  it('uses explicit availability_due_at date for Due line when present', () => {
    const line = resolveAvailabilityDueSupportLine(
      { start_date: '2026-04-01', availability_due_at: '2026-04-10T23:59:59.000Z' },
      false
    )
    expect(line).toMatch(/^Due /)
  })

  it('falls back to day-before-start when availability_due_at is absent', () => {
    const line = resolveAvailabilityDueSupportLine({ start_date: '2026-04-15' }, false)
    expect(line).toBe('Due Apr 14, 2026')
  })

  it('returns null for due line when submitted', () => {
    expect(
      resolveAvailabilityDueSupportLine(
        { start_date: '2026-04-01', availability_due_at: null },
        true
      )
    ).toBeNull()
  })
})
