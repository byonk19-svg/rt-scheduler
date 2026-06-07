import { describe, expect, it, vi } from 'vitest'

import {
  authorizeScheduleMutationManager,
  type ScheduleMutationManagerProfile,
} from './authorize-manager'
import type { createClient } from '@/lib/supabase/server'

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>

function makeSupabaseMock(params: {
  user?: { id: string } | null
  profile?: ScheduleMutationManagerProfile | null
}) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: params.profile ?? null, error: null })),
  }

  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: params.user === undefined ? { id: 'manager-1' } : params.user,
        },
      })),
    },
    from: vi.fn(() => query),
  } as unknown as ScheduleMutationSupabaseClient

  return { supabase, query }
}

describe('authorizeScheduleMutationManager', () => {
  it('returns unauthorized when there is no authenticated user', async () => {
    const { supabase } = makeSupabaseMock({ user: null })

    await expect(authorizeScheduleMutationManager(supabase)).resolves.toEqual({
      ok: false,
      status: 401,
      error: 'Unauthorized',
      code: 'unauthorized',
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('loads the manager site scope for an active manager', async () => {
    const profile = {
      role: 'manager',
      is_active: true,
      archived_at: null,
      site_id: 'site-a',
    }
    const { supabase, query } = makeSupabaseMock({ profile })

    await expect(authorizeScheduleMutationManager(supabase)).resolves.toEqual({
      ok: true,
      userId: 'manager-1',
      managerSiteId: 'site-a',
      profile,
    })
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(query.select).toHaveBeenCalledWith('role, is_active, archived_at, site_id')
    expect(query.eq).toHaveBeenCalledWith('id', 'manager-1')
  })

  it('returns manager_access_required for non-manager access', async () => {
    const { supabase } = makeSupabaseMock({
      profile: {
        role: 'therapist',
        is_active: true,
        archived_at: null,
        site_id: 'site-a',
      },
    })

    await expect(authorizeScheduleMutationManager(supabase)).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Manager access required',
      code: 'manager_access_required',
    })
  })

  it('returns manager_access_required for inactive or archived managers', async () => {
    for (const profile of [
      {
        role: 'manager',
        is_active: false,
        archived_at: null,
        site_id: 'site-a',
      },
      {
        role: 'manager',
        is_active: true,
        archived_at: '2026-03-01T00:00:00.000Z',
        site_id: 'site-a',
      },
    ]) {
      const { supabase } = makeSupabaseMock({ profile })

      await expect(authorizeScheduleMutationManager(supabase)).resolves.toEqual({
        ok: false,
        status: 403,
        error: 'Manager access required',
        code: 'manager_access_required',
      })
    }
  })

  it('returns manager_site_scope_required when the manager site is missing', async () => {
    for (const site_id of [null, undefined, '']) {
      const { supabase } = makeSupabaseMock({
        profile: {
          role: 'manager',
          is_active: true,
          archived_at: null,
          site_id,
        },
      })

      await expect(authorizeScheduleMutationManager(supabase)).resolves.toEqual({
        ok: false,
        status: 403,
        error: 'Manager site scope required',
        code: 'manager_site_scope_required',
      })
    }
  })
})
