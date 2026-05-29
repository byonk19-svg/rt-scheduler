import { describe, expect, it } from 'vitest'

import {
  availabilityDueDateKey,
  isTherapistVisibleForAvailability,
  normalizeAvailabilityDueDate,
  sortVisibleAvailabilityCycles,
  suggestNextScheduleBlock,
  suggestPlanningDates,
  validateScheduleBlockPlanning,
} from './schedule-block-planning'

describe('schedule block planning helpers', () => {
  it('suggests the next consecutive Sunday-start six-week block', () => {
    expect(
      suggestNextScheduleBlock([
        {
          id: 'current',
          label: 'Current',
          start_date: '2026-05-03',
          end_date: '2026-06-13',
        },
      ])
    ).toEqual(expect.objectContaining({ startDate: '2026-06-14', endDate: '2026-07-25' }))
  })

  it('suggests editable default milestone dates from the block start', () => {
    expect(suggestPlanningDates('2026-06-14', '2026-05-01')).toEqual({
      availabilityDueDate: '2026-05-24',
      preliminaryTargetDate: '2026-05-31',
      finalPublishTargetDate: '2026-06-07',
    })
  })

  it('keeps suggested milestone dates actionable when the next block is close', () => {
    expect(suggestPlanningDates('2026-05-31', '2026-05-29')).toEqual({
      availabilityDueDate: '2026-05-29',
      preliminaryTargetDate: '2026-05-30',
      finalPublishTargetDate: '2026-05-30',
    })
  })

  it('normalizes a manager date-only deadline to the end of that local day', () => {
    expect(availabilityDueDateKey(normalizeAvailabilityDueDate('2026-05-24'))).toBe('2026-05-24')
  })

  it('rejects overlapping schedule blocks', () => {
    const result = validateScheduleBlockPlanning(
      {
        startDate: '2026-06-07',
        endDate: '2026-07-18',
        availabilityDueDate: '2026-05-17',
        preliminaryTargetDate: '2026-05-24',
        finalPublishTargetDate: '2026-05-31',
      },
      [{ id: 'existing', start_date: '2026-05-03', end_date: '2026-06-13' }]
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('schedule_block_overlap')
  })

  it('rejects a due date after the schedule block starts', () => {
    const result = validateScheduleBlockPlanning(
      {
        startDate: '2026-06-14',
        endDate: '2026-07-25',
        availabilityDueDate: '2026-06-14',
        preliminaryTargetDate: '2026-06-15',
        finalPublishTargetDate: '2026-06-16',
      },
      []
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('availability_due_after_start')
  })

  it('allows same-day planning targets with a compressed timeline warning', () => {
    const result = validateScheduleBlockPlanning(
      {
        startDate: '2026-06-14',
        endDate: '2026-07-25',
        availabilityDueDate: '2026-05-31',
        preliminaryTargetDate: '2026-05-31',
        finalPublishTargetDate: '2026-06-07',
      },
      []
    )

    expect(result.valid).toBe(true)
    expect(result.warnings).toContain('compressed_timeline')
  })

  it('does not require preliminary or final target dates for therapist visibility', () => {
    const result = validateScheduleBlockPlanning(
      {
        startDate: '2026-06-14',
        endDate: '2026-07-25',
        availabilityDueDate: '2026-05-24',
        preliminaryTargetDate: null,
        finalPublishTargetDate: null,
      },
      []
    )

    expect(result.valid).toBe(true)
  })

  it('blocks clearing a visible availability due date', () => {
    const result = validateScheduleBlockPlanning(
      {
        startDate: '2026-06-14',
        endDate: '2026-07-25',
        availabilityDueDate: null,
        wasTherapistVisible: true,
      },
      []
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('visible_due_date_required')
  })

  it('sorts visible future blocks by due date then start date', () => {
    const sorted = sortVisibleAvailabilityCycles([
      {
        id: 'later-start-earlier-due',
        start_date: '2026-08-02',
        end_date: '2026-09-12',
        availability_due_at: '2026-06-21T23:59:59.999Z',
      },
      {
        id: 'earlier-start-later-due',
        start_date: '2026-06-14',
        end_date: '2026-07-25',
        availability_due_at: '2026-06-28T23:59:59.999Z',
      },
    ])

    expect(sorted.map((cycle) => cycle.id)).toEqual([
      'later-start-earlier-due',
      'earlier-start-later-due',
    ])
  })

  it('hides future therapist availability until a due date exists', () => {
    expect(
      isTherapistVisibleForAvailability(
        {
          start_date: '2026-06-14',
          end_date: '2026-07-25',
          availability_due_at: null,
          published: false,
          status: 'draft',
        },
        '2026-05-19'
      )
    ).toBe(false)
  })

  it('shows unpublished non-archived blocks with explicit availability due dates', () => {
    expect(
      isTherapistVisibleForAvailability(
        {
          start_date: '2026-06-14',
          end_date: '2026-07-25',
          availability_due_at: '2026-05-24T23:59:59.999Z',
          published: false,
          status: 'draft',
        },
        '2026-05-19'
      )
    ).toBe(true)
  })
})
