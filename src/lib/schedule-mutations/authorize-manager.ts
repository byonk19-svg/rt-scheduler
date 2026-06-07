import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import {
  SCHEDULE_MUTATION_ERROR_CODES as ERROR_CODES,
  type ScheduleMutationErrorCode,
} from '@/lib/schedule-mutations/errors'
import type { createClient } from '@/lib/supabase/server'

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>

export type ScheduleMutationManagerProfile = {
  role?: string | null
  is_active?: boolean | null
  archived_at?: string | null
  site_id?: string | null
}

export type ScheduleMutationManagerAuthorizationResult =
  | {
      ok: true
      userId: string
      managerSiteId: string
      profile: ScheduleMutationManagerProfile | null
    }
  | {
      ok: false
      status: 401 | 403
      error: string
      code: ScheduleMutationErrorCode
    }

export async function authorizeScheduleMutationManager(
  supabase: ScheduleMutationSupabaseClient
): Promise<ScheduleMutationManagerAuthorizationResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
      code: ERROR_CODES.unauthorized,
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at, site_id')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !can(parseRole(profile?.role), 'manage_coverage', {
      isActive: profile?.is_active !== false,
      archivedAt: profile?.archived_at ?? null,
    })
  ) {
    return {
      ok: false,
      status: 403,
      error: 'Manager access required',
      code: ERROR_CODES.managerAccessRequired,
    }
  }

  const managerSiteId = typeof profile?.site_id === 'string' ? profile.site_id : ''
  if (!managerSiteId) {
    return {
      ok: false,
      status: 403,
      error: 'Manager site scope required',
      code: ERROR_CODES.managerSiteScopeRequired,
    }
  }

  return {
    ok: true,
    userId: user.id,
    managerSiteId,
    profile: (profile as ScheduleMutationManagerProfile | null) ?? null,
  }
}
