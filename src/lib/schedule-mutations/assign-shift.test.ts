import { describe, expect, it, vi, beforeEach } from 'vitest'

import { assignScheduleShift } from './assign-shift'
import { writeAuditLog } from '@/lib/audit-log'
import { notifyPreliminaryShiftAdded } from '@/lib/preliminary-schedule-notifications'
import { notifyPublishedShiftAdded } from '@/lib/published-schedule-notifications'
import type { ScheduleMutationCycle } from '@/lib/schedule-mutations/load-cycle'
import type { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: vi.fn(async () => undefined),
}))

vi.mock('@/lib/preliminary-schedule-notifications', () => ({
  notifyPreliminaryShiftAdded: vi.fn(async () => undefined),
}))

vi.mock('@/lib/published-schedule-notifications', () => ({
  notifyPublishedShiftAdded: vi.fn(async () => undefined),
}))

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

function makeSupabaseMock(scenario: { insertError?: { code?: string; message?: string } } = {}) {
  const insertedShiftPayloads: Array<Record<string, unknown>> = []

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
      op: 'select' | 'insert'
      filters: Record<string, unknown>
      insertPayload?: Record<string, unknown>
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
            therapist_id: 'therapist-1',
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
        const hasCoverageFilters =
          typeof state.filters.cycle_id === 'string' &&
          typeof state.filters.date === 'string' &&
          typeof state.filters.shift_type === 'string'
        const hasWeeklyFilters =
          typeof state.filters.user_id === 'string' &&
          typeof state.filters['gte:date'] === 'string' &&
          typeof state.filters['lte:date'] === 'string'

        if (hasCoverageFilters) {
          return { data: [{ id: 'coverage-1', status: 'scheduled' }], error: null }
        }

        if (hasWeeklyFilters) {
          return { data: [], error: null }
        }

        if (state.op === 'insert' && single) {
          insertedShiftPayloads.push(state.insertPayload ?? {})
          if (scenario.insertError) {
            return { data: null, error: scenario.insertError }
          }
          return { data: { id: 'shift-new-1' }, error: null }
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
      insert: vi.fn((payload: Record<string, unknown>) => {
        state.op = 'insert'
        state.insertPayload = payload
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
    insertedShiftPayloads,
  }
}

describe('assignScheduleShift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('assigns a shift with the same payload, audit, notification, and undo response shape', async () => {
    const { supabase, insertedShiftPayloads } = makeSupabaseMock()

    const response = await assignScheduleShift(supabase, {
      payload: {
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'therapist-1',
        shiftType: 'day',
        date: '2026-03-10',
        role: 'lead',
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
      message: 'Shift assigned.',
      undoAction: {
        action: 'remove',
        cycleId: 'cycle-1',
        userId: 'therapist-1',
        date: '2026-03-10',
        shiftType: 'day',
      },
      shift: {
        id: 'shift-new-1',
        user_id: 'therapist-1',
        date: '2026-03-10',
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: null,
      },
    })
    expect(insertedShiftPayloads[0]).toMatchObject({
      cycle_id: 'cycle-1',
      site_id: 'site-a',
      user_id: 'therapist-1',
      date: '2026-03-10',
      shift_type: 'day',
      status: 'scheduled',
      role: 'lead',
    })
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'shift_added', targetId: 'shift-new-1' })
    )
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'post_publish_modification', targetId: 'shift-new-1' })
    )
    expect(notifyPublishedShiftAdded).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cyclePublished: true, userId: 'therapist-1' })
    )
    expect(notifyPreliminaryShiftAdded).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ preliminaryActive: true, userId: 'therapist-1' })
    )
  })

  it('returns duplicate_shift when the insert violates the one-shift-per-date constraint', async () => {
    const { supabase, insertedShiftPayloads } = makeSupabaseMock({
      insertError: { code: '23505', message: 'duplicate key' },
    })

    const response = await assignScheduleShift(supabase, {
      payload: {
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'therapist-1',
        shiftType: 'day',
        date: '2026-03-10',
        overrideWeeklyRules: false,
      },
      cycle: CYCLE,
      managerSiteId: 'site-a',
      actorId: 'manager-1',
      preliminaryActive: false,
      shouldLogPostPublishModification: async () => true,
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'That therapist already has a shift on this date.',
      code: 'duplicate_shift',
    })
    expect(insertedShiftPayloads).toHaveLength(1)
    expect(writeAuditLog).not.toHaveBeenCalled()
    expect(notifyPublishedShiftAdded).not.toHaveBeenCalled()
    expect(notifyPreliminaryShiftAdded).not.toHaveBeenCalled()
  })
})
