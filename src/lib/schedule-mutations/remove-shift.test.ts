import { beforeEach, describe, expect, it, vi } from 'vitest'

import { removeScheduleShift } from './remove-shift'
import { writeAuditLog } from '@/lib/audit-log'
import { notifyPreliminaryShiftRemoved } from '@/lib/preliminary-schedule-notifications'
import { notifyPublishedShiftRemoved } from '@/lib/published-schedule-notifications'
import type { ScheduleMutationCycle } from '@/lib/schedule-mutations/load-cycle'
import {
  ShiftPostCleanupError,
  preserveShiftPostHistoryBeforeShiftDeletion,
} from '@/lib/shift-post-cleanup'
import type { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: vi.fn(async () => undefined),
}))

vi.mock('@/lib/preliminary-schedule-notifications', () => ({
  notifyPreliminaryShiftRemoved: vi.fn(async () => undefined),
}))

vi.mock('@/lib/published-schedule-notifications', () => ({
  notifyPublishedShiftRemoved: vi.fn(async () => undefined),
}))

vi.mock('@/lib/shift-post-cleanup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shift-post-cleanup')>()
  return {
    ...actual,
    preserveShiftPostHistoryBeforeShiftDeletion: vi.fn(async () => undefined),
  }
})

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>

const CYCLE: ScheduleMutationCycle = {
  id: 'cycle-1',
  site_id: 'site-a',
  start_date: '2026-03-01',
  end_date: '2026-03-31',
  published: true,
  status: 'final',
  archived_at: null,
}

function makeSupabaseMock() {
  const deletedShiftIds: string[] = []

  const from = (table: string) => {
    const state: {
      table: string
      op: 'select' | 'delete'
      filters: Record<string, unknown>
    } = { table, op: 'select', filters: {} }

    const resolveSelect = (single: boolean) => {
      if (table === 'shifts') {
        if (state.op === 'delete') {
          deletedShiftIds.push(String(state.filters.id))
          return { data: null, error: null }
        }

        return {
          data: {
            id: 'shift-1',
            cycle_id: 'cycle-1',
            site_id: 'site-a',
            user_id: 'therapist-2',
            date: '2026-03-12',
            shift_type: 'night',
            role: 'staff',
          },
          error: null,
        }
      }

      return { data: single ? null : [], error: null }
    }

    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        state.filters[column] = value
        return builder
      }),
      delete: vi.fn(() => {
        state.op = 'delete'
        return builder
      }),
      maybeSingle: vi.fn(async () => resolveSelect(true)),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(resolveSelect(false)).then(resolve),
    }

    return builder
  }

  return {
    supabase: { from: vi.fn(from) } as unknown as ScheduleMutationSupabaseClient,
    deletedShiftIds,
  }
}

describe('removeScheduleShift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes a shift with the same cleanup, audit, notification, and undo behavior', async () => {
    const { supabase, deletedShiftIds } = makeSupabaseMock()

    const response = await removeScheduleShift(supabase, {
      payload: {
        action: 'remove',
        cycleId: 'cycle-1',
        shiftId: 'shift-1',
      },
      cycle: CYCLE,
      managerSiteId: 'site-a',
      actorId: 'manager-1',
      preliminaryActive: true,
      shouldLogPostPublishModification: async () => true,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: 'Shift removed from schedule.',
      undoAction: {
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'therapist-2',
        shiftType: 'night',
        date: '2026-03-12',
        overrideWeeklyRules: true,
      },
    })
    expect(preserveShiftPostHistoryBeforeShiftDeletion).toHaveBeenCalledWith(
      expect.anything(),
      ['shift-1'],
      'Schedule changed after this request was posted.'
    )
    expect(deletedShiftIds).toEqual(['shift-1'])
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'shift_removed', targetId: 'shift-1' })
    )
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'post_publish_modification', targetId: 'shift-1' })
    )
    expect(notifyPublishedShiftRemoved).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cyclePublished: true, userId: 'therapist-2' })
    )
    expect(notifyPreliminaryShiftRemoved).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ preliminaryActive: true, userId: 'therapist-2' })
    )
  })

  it('does not delete when linked Shift Board cleanup fails', async () => {
    const { supabase, deletedShiftIds } = makeSupabaseMock()
    vi.mocked(preserveShiftPostHistoryBeforeShiftDeletion).mockRejectedValueOnce(
      new ShiftPostCleanupError('cleanup failed')
    )

    const response = await removeScheduleShift(supabase, {
      payload: {
        action: 'remove',
        cycleId: 'cycle-1',
        shiftId: 'shift-1',
      },
      cycle: CYCLE,
      managerSiteId: 'site-a',
      actorId: 'manager-1',
      preliminaryActive: true,
      shouldLogPostPublishModification: async () => true,
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error:
        'Could not preserve linked Shift Board requests. Try again before changing this schedule.',
      code: 'internal_error',
    })
    expect(deletedShiftIds).toEqual([])
    expect(writeAuditLog).not.toHaveBeenCalled()
    expect(notifyPublishedShiftRemoved).not.toHaveBeenCalled()
    expect(notifyPreliminaryShiftRemoved).not.toHaveBeenCalled()
  })
})
