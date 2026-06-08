import { describe, expect, it, vi } from 'vitest'

import { loadScheduleMutationCycle, type ScheduleMutationCycle } from './load-cycle'
import type { createClient } from '@/lib/supabase/server'

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>

const BASE_CYCLE: ScheduleMutationCycle = {
  id: 'cycle-1',
  site_id: 'site-a',
  start_date: '2026-03-01',
  end_date: '2026-03-31',
  published: false,
  status: 'draft',
  archived_at: null,
}

function makeSupabaseMock(result: {
  cycle?: ScheduleMutationCycle | null
  error?: { message: string } | null
}) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({
      data: result.cycle === undefined ? BASE_CYCLE : result.cycle,
      error: result.error ?? null,
    })),
  }

  const supabase = {
    from: vi.fn(() => query),
  } as unknown as ScheduleMutationSupabaseClient

  return { supabase, query }
}

describe('loadScheduleMutationCycle', () => {
  it('loads a schedule cycle for the manager site', async () => {
    const { supabase, query } = makeSupabaseMock({})

    await expect(loadScheduleMutationCycle(supabase, 'cycle-1', 'site-a')).resolves.toEqual({
      ok: true,
      cycle: BASE_CYCLE,
    })
    expect(supabase.from).toHaveBeenCalledWith('schedule_cycles')
    expect(query.select).toHaveBeenCalledWith(
      'id, site_id, start_date, end_date, published, status, archived_at'
    )
    expect(query.eq).toHaveBeenCalledWith('id', 'cycle-1')
  })

  it.each([
    { cycle: null, error: null },
    { cycle: BASE_CYCLE, error: { message: 'read failed' } },
  ])('returns cycle_not_found for missing or failed cycle reads %#', async (result) => {
    const { supabase } = makeSupabaseMock(result)

    await expect(loadScheduleMutationCycle(supabase, 'cycle-1', 'site-a')).resolves.toEqual({
      ok: false,
      status: 404,
      error: 'Schedule Block not found',
      code: 'cycle_not_found',
    })
  })

  it('returns outside_site_scope when the cycle is outside the manager site', async () => {
    const { supabase } = makeSupabaseMock({
      cycle: {
        ...BASE_CYCLE,
        site_id: 'site-b',
      },
    })

    await expect(loadScheduleMutationCycle(supabase, 'cycle-1', 'site-a')).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Schedule Block is outside your site scope.',
      code: 'outside_site_scope',
    })
  })

  it('returns cycle_read_only for offline cycles', async () => {
    const { supabase } = makeSupabaseMock({
      cycle: {
        ...BASE_CYCLE,
        status: 'offline',
      },
    })

    await expect(loadScheduleMutationCycle(supabase, 'cycle-1', 'site-a')).resolves.toEqual({
      ok: false,
      status: 409,
      error: 'This Schedule Block is read-only until it is republished.',
      code: 'cycle_read_only',
    })
  })

  it('returns cycle_read_only for archived status cycles', async () => {
    const { supabase } = makeSupabaseMock({
      cycle: {
        ...BASE_CYCLE,
        status: 'archived',
      },
    })

    await expect(loadScheduleMutationCycle(supabase, 'cycle-1', 'site-a')).resolves.toEqual({
      ok: false,
      status: 409,
      error: 'This Schedule Block is read-only until it is republished.',
      code: 'cycle_read_only',
    })
  })

  it('returns cycle_read_only when archived_at is present', async () => {
    const { supabase } = makeSupabaseMock({
      cycle: {
        ...BASE_CYCLE,
        archived_at: '2026-03-01T00:00:00.000Z',
      },
    })

    await expect(loadScheduleMutationCycle(supabase, 'cycle-1', 'site-a')).resolves.toEqual({
      ok: false,
      status: 409,
      error: 'This Schedule Block is read-only until it is republished.',
      code: 'cycle_read_only',
    })
  })
})
