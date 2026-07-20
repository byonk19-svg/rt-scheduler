import { beforeEach, describe, expect, it, vi } from 'vitest'

import { moveScheduleShift } from './move-shift'
import { writeAuditLog } from '@/lib/audit-log'
import { notifyPreliminaryShiftMoved } from '@/lib/preliminary-schedule-notifications'
import { notifyPublishedShiftMoved } from '@/lib/published-schedule-notifications'
import type { ScheduleMutationCycle } from '@/lib/schedule-mutations/load-cycle'
import { closePendingShiftPostsForShiftIds } from '@/lib/shift-post-cleanup'
import type { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: vi.fn(async () => undefined),
}))

vi.mock('@/lib/preliminary-schedule-notifications', () => ({
  notifyPreliminaryShiftMoved: vi.fn(async () => undefined),
}))

vi.mock('@/lib/published-schedule-notifications', () => ({
  notifyPublishedShiftMoved: vi.fn(async () => undefined),
}))

vi.mock('@/lib/shift-post-cleanup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shift-post-cleanup')>()
  return {
    ...actual,
    closePendingShiftPostsForShiftIds: vi.fn(async () => undefined),
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

function makeSupabaseMock(scenario: { updateError?: { code?: string; message?: string } } = {}) {
  const updatedShiftPayloads: Array<{
    filters: Record<string, unknown>
    payload: Record<string, unknown>
  }> = []

  const profileById = (id: string) => ({
    id,
    role: 'therapist',
    is_lead_eligible: false,
    site_id: 'site-a',
    shift_type: 'day',
    is_active: true,
    archived_at: null,
    on_fmla: false,
    full_name: 'Alex Jones',
    employment_type: 'full_time',
    max_work_days_per_week: 3,
  })

  const from = (table: string) => {
    const state: {
      table: string
      op: 'select' | 'update'
      filters: Record<string, unknown>
      updatePayload?: Record<string, unknown>
    } = { table, op: 'select', filters: {} }

    const resolveSelect = (single: boolean) => {
      if (table === 'profiles') {
        return { data: profileById(String(state.filters.id)), error: null }
      }

      if (table === 'availability_overrides') {
        return { data: [], error: null }
      }

      if (table === 'work_patterns') {
        return {
          data: {
            therapist_id: 'therapist-2',
            pattern_type: 'weekly_fixed',
            works_dow: [1, 2, 3, 5],
            offs_dow: [],
            weekend_rotation: null,
            weekend_anchor_date: null,
            works_dow_mode: 'hard',
            weekly_weekdays: [1, 2, 3, 5],
            weekend_rule: null,
            cycle_anchor_date: null,
            cycle_segments: [],
            shift_preference: 'either',
          },
          error: null,
        }
      }

      if (table === 'shifts') {
        const hasIdFilter = state.filters.id === 'shift-1'
        const hasCoverageFilters =
          typeof state.filters.cycle_id === 'string' &&
          typeof state.filters.date === 'string' &&
          typeof state.filters.shift_type === 'string'
        const hasWeeklyFilters =
          typeof state.filters.user_id === 'string' &&
          typeof state.filters['gte:date'] === 'string' &&
          typeof state.filters['lte:date'] === 'string'

        if (single && hasIdFilter) {
          return {
            data: {
              id: 'shift-1',
              cycle_id: 'cycle-1',
              site_id: 'site-a',
              user_id: 'therapist-2',
              date: '2026-03-12',
              shift_type: 'day',
              status: 'scheduled',
              role: 'staff',
            },
            error: null,
          }
        }

        if (state.op === 'update') {
          updatedShiftPayloads.push({
            filters: { ...state.filters },
            payload: state.updatePayload ?? {},
          })
          return { data: null, error: scenario.updateError ?? null }
        }

        if (hasCoverageFilters) {
          return { data: [{ id: 'coverage-1', status: 'scheduled' }], error: null }
        }

        if (hasWeeklyFilters) {
          return { data: [], error: null }
        }
      }

      if (table === 'shift_operational_entries') {
        return { data: [], error: null }
      }

      return { data: single ? null : [], error: null }
    }

    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        state.filters[column] = value
        return builder
      }),
      neq: vi.fn((column: string, value: unknown) => {
        state.filters[`neq:${column}`] = value
        return builder
      }),
      gte: vi.fn((column: string, value: unknown) => {
        state.filters[`gte:${column}`] = value
        return builder
      }),
      lte: vi.fn((column: string, value: unknown) => {
        state.filters[`lte:${column}`] = value
        return builder
      }),
      in: vi.fn((column: string, value: unknown[]) => {
        state.filters[`in:${column}`] = value
        return builder
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        state.op = 'update'
        state.updatePayload = payload
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
    updatedShiftPayloads,
  }
}

describe('moveScheduleShift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('moves a shift with the same update, cleanup, audit, notification, and undo behavior', async () => {
    const { supabase, updatedShiftPayloads } = makeSupabaseMock()

    const response = await moveScheduleShift(supabase, {
      payload: {
        action: 'move',
        cycleId: 'cycle-1',
        shiftId: 'shift-1',
        targetDate: '2026-03-13',
        targetShiftType: 'day',
        overrideWeeklyRules: false,
      },
      cycle: CYCLE,
      managerSiteId: 'site-a',
      actorId: 'manager-1',
      preliminaryActive: true,
      shouldLogPostPublishModification: async () => true,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: 'Shift moved.',
      undoAction: {
        action: 'move',
        cycleId: 'cycle-1',
        shiftId: 'shift-1',
        targetDate: '2026-03-12',
        targetShiftType: 'day',
        overrideWeeklyRules: true,
      },
    })
    expect(updatedShiftPayloads[0]).toEqual({
      filters: {
        id: 'shift-1',
        cycle_id: 'cycle-1',
        site_id: 'site-a',
      },
      payload: {
        date: '2026-03-13',
        shift_type: 'day',
        availability_override: false,
        availability_override_reason: null,
        availability_override_by: null,
        availability_override_at: null,
      },
    })
    expect(closePendingShiftPostsForShiftIds).toHaveBeenCalledWith(
      expect.anything(),
      ['shift-1'],
      'Schedule changed after this request was posted.'
    )
    expect(notifyPublishedShiftMoved).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cyclePublished: true,
        userId: 'therapist-2',
        fromDate: '2026-03-12',
        toDate: '2026-03-13',
      })
    )
    expect(notifyPreliminaryShiftMoved).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ preliminaryActive: true, userId: 'therapist-2' })
    )
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'manager-1',
        action: 'post_publish_modification',
        targetType: 'shift',
        targetId: 'shift-1',
      })
    )
  })

  it('returns duplicate_shift when the target date already has a shift for the therapist', async () => {
    const { supabase } = makeSupabaseMock({
      updateError: { code: '23505', message: 'duplicate key' },
    })

    const response = await moveScheduleShift(supabase, {
      payload: {
        action: 'move',
        cycleId: 'cycle-1',
        shiftId: 'shift-1',
        targetDate: '2026-03-13',
        targetShiftType: 'day',
        overrideWeeklyRules: false,
      },
      cycle: CYCLE,
      managerSiteId: 'site-a',
      actorId: 'manager-1',
      preliminaryActive: true,
      shouldLogPostPublishModification: async () => true,
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Therapist already has a shift on that date.',
      code: 'duplicate_shift',
    })
    expect(closePendingShiftPostsForShiftIds).not.toHaveBeenCalled()
    expect(notifyPublishedShiftMoved).not.toHaveBeenCalled()
    expect(notifyPreliminaryShiftMoved).not.toHaveBeenCalled()
    expect(writeAuditLog).not.toHaveBeenCalled()
  })
})
