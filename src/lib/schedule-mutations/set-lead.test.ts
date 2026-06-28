import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setScheduleMutationLead } from './set-lead'
import { writeAuditLog } from '@/lib/audit-log'
import { notifyPublishedShiftAdded } from '@/lib/published-schedule-notifications'
import type { ScheduleMutationCycle } from '@/lib/schedule-mutations/load-cycle'
import { closePendingShiftPostsForShiftIds } from '@/lib/shift-post-cleanup'
import type { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: vi.fn(async () => undefined),
}))

vi.mock('@/lib/published-schedule-notifications', () => ({
  notifyPublishedShiftAdded: vi.fn(async () => undefined),
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

function makeSupabaseMock(scenario: { rpcError?: { code?: string; message?: string } } = {}) {
  const updatedShiftPayloads: Array<{
    filters: Record<string, unknown>
    payload: Record<string, unknown>
  }> = []

  const from = (table: string) => {
    const state: {
      table: string
      op: 'select' | 'update'
      filters: Record<string, unknown>
      updatePayload?: Record<string, unknown>
    } = { table, op: 'select', filters: {} }

    const resolveSelect = (single: boolean) => {
      if (table === 'profiles') {
        return {
          data: {
            id: 'therapist-lead',
            role: 'therapist',
            is_lead_eligible: true,
            site_id: 'site-a',
            shift_type: 'day',
            is_active: true,
            archived_at: null,
            on_fmla: false,
            full_name: 'Lead Therapist',
            employment_type: 'full_time',
          },
          error: null,
        }
      }

      if (table === 'availability_overrides') {
        return { data: [], error: null }
      }

      if (table === 'work_patterns') {
        return {
          data: {
            therapist_id: 'therapist-lead',
            pattern_type: 'weekly_fixed',
            works_dow: [1, 2, 3],
            offs_dow: [],
            weekend_rotation: null,
            weekend_anchor_date: null,
            works_dow_mode: 'hard',
            weekly_weekdays: [1, 2, 3],
            weekend_rule: null,
            cycle_anchor_date: null,
            cycle_segments: [],
            shift_preference: 'either',
          },
          error: null,
        }
      }

      if (table === 'shifts') {
        if (state.op === 'update') {
          updatedShiftPayloads.push({
            filters: { ...state.filters },
            payload: state.updatePayload ?? {},
          })
          return { data: null, error: null }
        }

        return {
          data: {
            id: 'shift-existing',
            status: 'scheduled',
          },
          error: null,
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
    supabase: {
      from: vi.fn(from),
      rpc: vi.fn(async () => ({ error: scenario.rpcError ?? null })),
    } as unknown as ScheduleMutationSupabaseClient,
    updatedShiftPayloads,
  }
}

describe('setScheduleMutationLead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets a designated lead with the same mutation, metadata update, cleanup, audit, and response behavior', async () => {
    const { supabase, updatedShiftPayloads } = makeSupabaseMock()

    const response = await setScheduleMutationLead(supabase, {
      payload: {
        action: 'set_lead',
        cycleId: 'cycle-1',
        therapistId: 'therapist-lead',
        shiftType: 'day',
        date: '2026-03-10',
        overrideWeeklyRules: false,
      },
      cycle: CYCLE,
      managerSiteId: 'site-a',
      actorId: 'manager-1',
      preliminaryActive: true,
      shouldLogPostPublishModification: async () => true,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Designated lead updated.' })
    expect(supabase.rpc).toHaveBeenCalledWith('set_designated_shift_lead', {
      p_cycle_id: 'cycle-1',
      p_shift_date: '2026-03-10',
      p_shift_type: 'day',
      p_therapist_id: 'therapist-lead',
    })
    expect(updatedShiftPayloads[0]).toEqual({
      filters: {
        cycle_id: 'cycle-1',
        user_id: 'therapist-lead',
        date: '2026-03-10',
        shift_type: 'day',
        site_id: 'site-a',
      },
      payload: {
        availability_override: false,
        availability_override_reason: null,
        availability_override_by: null,
        availability_override_at: null,
      },
    })
    expect(notifyPublishedShiftAdded).not.toHaveBeenCalled()
    expect(closePendingShiftPostsForShiftIds).toHaveBeenCalledWith(
      expect.anything(),
      ['shift-existing'],
      'Schedule changed after this request was posted.'
    )
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'designated_lead_assigned',
        targetType: 'shift_slot',
        targetId: 'cycle-1:2026-03-10:day',
      })
    )
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'post_publish_modification',
        targetType: 'shift',
        targetId: 'shift-existing',
      })
    )
  })

  it('returns duplicate_designated_lead when the mutation prevents multiple leads', async () => {
    const { supabase, updatedShiftPayloads } = makeSupabaseMock({
      rpcError: { code: '23505', message: 'duplicate key' },
    })

    const response = await setScheduleMutationLead(supabase, {
      payload: {
        action: 'set_lead',
        cycleId: 'cycle-1',
        therapistId: 'therapist-lead',
        shiftType: 'day',
        date: '2026-03-10',
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
      error: 'A designated lead already exists for that shift.',
      code: 'duplicate_designated_lead',
    })
    expect(updatedShiftPayloads).toEqual([])
    expect(closePendingShiftPostsForShiftIds).not.toHaveBeenCalled()
    expect(writeAuditLog).not.toHaveBeenCalled()
  })
})
