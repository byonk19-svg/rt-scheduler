import {
  SCHEDULE_MUTATION_ERROR_CODES as ERROR_CODES,
  type ScheduleMutationErrorCode,
} from '@/lib/schedule-mutations/errors'
import type { createClient } from '@/lib/supabase/server'

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>

export type ScheduleMutationCycle = {
  id: string
  site_id: string | null
  start_date: string
  end_date: string
  published: boolean | null
  status: string | null
  archived_at: string | null
}

export type LoadScheduleMutationCycleResult =
  | {
      ok: true
      cycle: ScheduleMutationCycle
    }
  | {
      ok: false
      status: 403 | 404 | 409
      error: string
      code: ScheduleMutationErrorCode
    }

export async function loadScheduleMutationCycle(
  supabase: ScheduleMutationSupabaseClient,
  cycleId: string,
  managerSiteId: string
): Promise<LoadScheduleMutationCycleResult> {
  const { data, error } = await supabase
    .from('schedule_cycles')
    .select('id, site_id, start_date, end_date, published, status, archived_at')
    .eq('id', cycleId)
    .maybeSingle()

  const cycle = (data as ScheduleMutationCycle | null) ?? null

  if (error || !cycle) {
    return {
      ok: false,
      status: 404,
      error: 'Schedule Block not found',
      code: ERROR_CODES.cycleNotFound,
    }
  }

  if (cycle.site_id !== managerSiteId) {
    return {
      ok: false,
      status: 403,
      error: 'Schedule Block is outside your site scope.',
      code: ERROR_CODES.outsideSiteScope,
    }
  }

  if (cycle.status === 'offline' || cycle.status === 'archived' || cycle.archived_at) {
    return {
      ok: false,
      status: 409,
      error: 'This Schedule Block is read-only until it is republished.',
      code: ERROR_CODES.cycleReadOnly,
    }
  }

  return {
    ok: true,
    cycle,
  }
}
