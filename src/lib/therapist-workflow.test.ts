import { describe, expect, it } from 'vitest'

import { resolveTherapistActionCycleId, resolveTherapistWorkflow } from '@/lib/therapist-workflow'

describe('therapist-workflow', () => {
  const todayKey = '2026-04-24'

  it('treats saved overrides without official submission as a draft availability workflow', () => {
    const workflow = resolveTherapistWorkflow({
      todayKey,
      cycles: [
        {
          id: 'cycle-draft',
          label: 'May 2026',
          start_date: '2026-05-10',
          end_date: '2026-06-20',
          published: false,
          availability_due_at: '2026-05-01T23:59:59.000Z',
        },
      ],
      availabilityEntryCountsByCycleId: { 'cycle-draft': 4 },
      submissionsByCycleId: {},
      preliminarySnapshots: [],
      publishedShifts: [],
      relevantShiftPostSummary: { pendingCount: 0, totalCount: 0 },
    })

    expect(workflow.state).toBe('availability_draft')
    expect(workflow.stateLabel).toBe('Draft saved')
    expect(workflow.primaryTitle).toBe('Needs your availability')
    expect(workflow.primaryAction.href).toBe('/therapist/availability?cycle=cycle-draft')
    expect(workflow.primaryAction.label).toBe('Continue availability')
  })

  it('prioritizes preliminary review when an active preliminary snapshot exists', () => {
    const workflow = resolveTherapistWorkflow({
      todayKey,
      cycles: [
        {
          id: 'cycle-prelim',
          label: 'June 2026',
          start_date: '2026-06-21',
          end_date: '2026-08-01',
          published: false,
          availability_due_at: '2026-06-05T23:59:59.000Z',
        },
      ],
      availabilityEntryCountsByCycleId: { 'cycle-prelim': 8 },
      submissionsByCycleId: {
        'cycle-prelim': {
          submittedAt: '2026-05-28T12:00:00.000Z',
          lastEditedAt: '2026-05-29T12:00:00.000Z',
        },
      },
      preliminarySnapshots: [{ cycle_id: 'cycle-prelim', status: 'active' }],
      publishedShifts: [],
      relevantShiftPostSummary: { pendingCount: 0, totalCount: 0 },
    })

    expect(workflow.state).toBe('preliminary_review_available')
    expect(workflow.stateLabel).toBe('Review preliminary schedule')
    expect(workflow.primaryAction.href).toBe('/preliminary')
    expect(workflow.primaryAction.label).toBe('Review preliminary schedule')
  })

  it('falls back to the published schedule when no future cycle needs therapist input', () => {
    const workflow = resolveTherapistWorkflow({
      todayKey,
      cycles: [
        {
          id: 'cycle-published',
          label: 'Current cycle',
          start_date: '2026-04-13',
          end_date: '2026-05-24',
          published: true,
        },
      ],
      availabilityEntryCountsByCycleId: {},
      submissionsByCycleId: {},
      preliminarySnapshots: [],
      publishedShifts: [
        { cycle_id: 'cycle-published', date: '2026-04-25' },
        { cycle_id: 'cycle-published', date: '2026-04-27' },
      ],
      relevantShiftPostSummary: { pendingCount: 3, totalCount: 5 },
    })

    expect(workflow.state).toBe('published_schedule_available')
    expect(workflow.stateLabel).toBe('Final schedule ready')
    expect(workflow.primaryAction.href).toBe('/therapist/schedule?cycle=cycle-published')
    expect(workflow.secondaryAction).toEqual({
      href: '/therapist/swaps',
      label: 'Shift Swaps & Pickups',
    })
    expect(workflow.swapSummary.pendingCount).toBe(3)
    expect(workflow.swapSummary.totalCount).toBe(5)
    expect(workflow.publishedShiftSummary.upcomingCount).toBe(2)
  })

  it('marks an expired unpublished cycle as closed when no therapist action remains', () => {
    const workflow = resolveTherapistWorkflow({
      todayKey,
      cycles: [
        {
          id: 'cycle-closed',
          label: 'Past cycle',
          start_date: '2026-03-01',
          end_date: '2026-04-12',
          published: false,
          availability_due_at: '2026-02-22T23:59:59.000Z',
        },
      ],
      availabilityEntryCountsByCycleId: {},
      submissionsByCycleId: {},
      preliminarySnapshots: [],
      publishedShifts: [],
      relevantShiftPostSummary: { pendingCount: 0, totalCount: 2 },
    })

    expect(workflow.state).toBe('cycle_closed')
    expect(workflow.stateLabel).toBe('Cycle closed')
    expect(workflow.primaryAction.href).toBe('/staff/history')
    expect(workflow.primaryAction.label).toBe('View history')
  })
})

describe('resolveTherapistActionCycleId', () => {
  const cycles = [
    {
      id: 'published-cycle',
      label: 'Published',
      start_date: '2026-04-01',
      end_date: '2026-05-12',
      published: true,
    },
    {
      id: 'next-cycle',
      label: 'Next cycle',
      start_date: '2026-05-13',
      end_date: '2026-06-23',
      published: false,
    },
  ]

  it('selects the next unpublished cycle requiring therapist availability input', () => {
    expect(
      resolveTherapistActionCycleId({
        todayKey: '2026-04-24',
        cycles,
        preliminarySnapshots: [],
      })
    ).toBe('next-cycle')
  })

  it('uses the preliminary cycle when a live preliminary snapshot exists', () => {
    expect(
      resolveTherapistActionCycleId({
        todayKey: '2026-04-24',
        cycles,
        preliminarySnapshots: [{ cycle_id: 'next-cycle', status: 'active' }],
      })
    ).toBe('next-cycle')
  })
})
