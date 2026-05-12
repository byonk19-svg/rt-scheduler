import type { SupabaseClient } from '@supabase/supabase-js'

type AvailabilityWindowCycle = {
  id: string
  published?: boolean | null
  status?: string | null
  archived_at?: string | null
  availability_closed_at?: string | null
  availability_reopened_at?: string | null
}

export type AvailabilityWindowState = {
  locked: boolean
  reason:
    | 'archived'
    | 'published'
    | 'offline'
    | 'preliminary'
    | 'manager_closed'
    | 'schedule_building_started'
    | null
}

export function resolveAvailabilityWindowState(params: {
  cycle: AvailabilityWindowCycle | null | undefined
  hasDraftSchedule: boolean
}): AvailabilityWindowState {
  const cycle = params.cycle
  if (!cycle) return { locked: true, reason: 'manager_closed' }

  if (cycle.archived_at || cycle.status === 'archived') return { locked: true, reason: 'archived' }
  if (cycle.published || cycle.status === 'final') return { locked: true, reason: 'published' }
  if (cycle.status === 'offline') return { locked: true, reason: 'offline' }
  if (cycle.status === 'preliminary') return { locked: true, reason: 'preliminary' }

  const closedAt = cycle.availability_closed_at
    ? new Date(cycle.availability_closed_at).getTime()
    : null
  const reopenedAt = cycle.availability_reopened_at
    ? new Date(cycle.availability_reopened_at).getTime()
    : null
  if (closedAt !== null && (reopenedAt === null || closedAt >= reopenedAt)) {
    return { locked: true, reason: 'manager_closed' }
  }

  if (params.hasDraftSchedule && reopenedAt === null) {
    return { locked: true, reason: 'schedule_building_started' }
  }

  return { locked: false, reason: null }
}

export async function loadAvailabilityWindowState(
  supabase: SupabaseClient,
  cycleId: string
): Promise<AvailabilityWindowState> {
  if (!cycleId) return { locked: true, reason: 'manager_closed' }

  const [{ data: cycle }, { count }] = await Promise.all([
    supabase
      .from('schedule_cycles')
      .select(
        'id, published, status, archived_at, availability_closed_at, availability_reopened_at'
      )
      .eq('id', cycleId)
      .maybeSingle(),
    supabase
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycleId)
      .limit(1),
  ])

  return resolveAvailabilityWindowState({
    cycle: (cycle ?? null) as AvailabilityWindowCycle | null,
    hasDraftSchedule: (count ?? 0) > 0,
  })
}
