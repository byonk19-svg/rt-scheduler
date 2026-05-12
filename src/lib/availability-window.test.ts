import { describe, expect, it } from 'vitest'

import { resolveAvailabilityWindowState } from './availability-window'

describe('resolveAvailabilityWindowState', () => {
  const openDraftCycle = {
    id: 'cycle-1',
    published: false,
    status: 'draft',
    archived_at: null,
    availability_closed_at: null,
    availability_reopened_at: null,
  }

  it('locks once schedule building has started', () => {
    expect(
      resolveAvailabilityWindowState({
        cycle: openDraftCycle,
        hasDraftSchedule: true,
      })
    ).toEqual({ locked: true, reason: 'schedule_building_started' })
  })

  it('keeps a manager-reopened draft cycle open even when draft shifts exist', () => {
    expect(
      resolveAvailabilityWindowState({
        cycle: {
          ...openDraftCycle,
          availability_reopened_at: '2026-05-12T12:00:00.000Z',
        },
        hasDraftSchedule: true,
      })
    ).toEqual({ locked: false, reason: null })
  })

  it('locks again when a manager closes after reopening', () => {
    expect(
      resolveAvailabilityWindowState({
        cycle: {
          ...openDraftCycle,
          availability_reopened_at: '2026-05-12T12:00:00.000Z',
          availability_closed_at: '2026-05-12T13:00:00.000Z',
        },
        hasDraftSchedule: true,
      })
    ).toEqual({ locked: true, reason: 'manager_closed' })
  })

  it('locks preliminary and final cycles regardless of reopen state', () => {
    expect(
      resolveAvailabilityWindowState({
        cycle: {
          ...openDraftCycle,
          status: 'preliminary',
          availability_reopened_at: '2026-05-12T12:00:00.000Z',
        },
        hasDraftSchedule: true,
      })
    ).toEqual({ locked: true, reason: 'preliminary' })

    expect(
      resolveAvailabilityWindowState({
        cycle: {
          ...openDraftCycle,
          published: true,
          status: 'final',
          availability_reopened_at: '2026-05-12T12:00:00.000Z',
        },
        hasDraftSchedule: true,
      })
    ).toEqual({ locked: true, reason: 'published' })
  })
})
