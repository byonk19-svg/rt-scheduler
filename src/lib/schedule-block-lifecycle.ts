import { writeAuditLog } from '@/lib/audit-log'
import {
  OFFLINE_SHIFT_BOARD_CLOSURE_REASON,
  canTakeScheduleBlockOffline,
} from '@/lib/schedule-lifecycle-matrix'
import { closePendingShiftPostsForShiftIds } from '@/lib/shift-post-cleanup'
import type { createClient } from '@/lib/supabase/server'

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

type ScheduleBlockLifecycleRow = {
  id: string
  published: boolean | null
  status: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
}

type ArchiveScheduleBlockLifecycleRow = {
  id: string
  published: boolean | null
  archived_at: string | null
  site_id: string | null
  status: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
}

export type TakeScheduleBlockOfflineMutationClient = {
  rpc: (
    fn: 'app_take_schedule_cycle_offline',
    args: { p_actor_id: string; p_cycle_id: string }
  ) => PromiseLike<{
    data: Array<{ id: string }> | { id: string } | null
    error: { message?: string } | null
  }>
}

export type PublishScheduleBlockMutationClient = {
  rpc: (
    fn: 'app_publish_schedule_cycle',
    args: { p_actor_id: string; p_cycle_id: string }
  ) => PromiseLike<{
    data: Array<{ id: string }> | { id: string } | null
    error: { message?: string } | null
  }>
}

export type PublishScheduleBlockLifecycleResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'mutation_failed'
        | 'state_changed'
        | 'unresolved_preliminary_marks'
        | 'unresolved_preliminary_requests'
        | 'republish_conflict'
        | 'availability_rule_violation'
        | 'shift_rule_violation'
        | 'invalid_state'
      error?: unknown
    }

export type TakeScheduleBlockOfflineLifecycleResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'cycle_lookup_failed'
        | 'not_live'
        | 'shift_lookup_failed'
        | 'mutation_failed'
        | 'state_changed'
      error?: unknown
    }

export type ArchiveScheduleBlockLifecycleResult =
  | { ok: true }
  | {
      ok: false
      reason: 'cycle_lookup_failed' | 'live' | 'outside_site' | 'mutation_failed'
      error?: unknown
    }

function classifyPublishMutationFailure(message: string | undefined) {
  const normalized = message ?? ''
  if (/resolve preliminary marks/i.test(normalized)) return 'unresolved_preliminary_marks'
  if (/resolve preliminary requests/i.test(normalized)) return 'unresolved_preliminary_requests'
  if (/another live block|same date range/i.test(normalized)) return 'republish_conflict'
  if (/Need to Work|Need Off|availability/i.test(normalized)) return 'availability_rule_violation'
  if (/designated lead|lead-capable assigned/i.test(normalized)) return 'shift_rule_violation'
  if (/draft or preliminary/i.test(normalized)) return 'invalid_state'
  return 'mutation_failed'
}

export async function publishScheduleBlockLifecycle(params: {
  mutationClient: PublishScheduleBlockMutationClient
  actorId: string
  cycleId: string
}): Promise<PublishScheduleBlockLifecycleResult> {
  const { mutationClient, actorId, cycleId } = params

  const { data: updatedRows, error } = await mutationClient.rpc('app_publish_schedule_cycle', {
    p_actor_id: actorId,
    p_cycle_id: cycleId,
  })

  if (error) {
    return { ok: false, reason: classifyPublishMutationFailure(error.message), error }
  }

  const hasUpdatedRow = Array.isArray(updatedRows) ? updatedRows.length > 0 : Boolean(updatedRows)
  if (!hasUpdatedRow) {
    return { ok: false, reason: 'state_changed' }
  }

  return { ok: true }
}

export async function takeScheduleBlockOfflineLifecycle(params: {
  supabase: ServerSupabaseClient
  mutationClient: TakeScheduleBlockOfflineMutationClient
  actorId: string
  cycleId: string
}): Promise<TakeScheduleBlockOfflineLifecycleResult> {
  const { supabase, mutationClient, actorId, cycleId } = params

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, published, status')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    return { ok: false, reason: 'cycle_lookup_failed', error: cycleError }
  }

  if (!canTakeScheduleBlockOffline(cycle as ScheduleBlockLifecycleRow)) {
    return { ok: false, reason: 'not_live' }
  }

  const { data: currentShifts, error: shiftsError } = await supabase
    .from('shifts')
    .select('id')
    .eq('cycle_id', cycleId)

  if (shiftsError) {
    return { ok: false, reason: 'shift_lookup_failed', error: shiftsError }
  }

  const { data: offlineRows, error: offlineError } = await mutationClient.rpc(
    'app_take_schedule_cycle_offline',
    {
      p_actor_id: actorId,
      p_cycle_id: cycleId,
    }
  )

  if (offlineError) {
    return { ok: false, reason: 'mutation_failed', error: offlineError }
  }

  const hasOfflineRow = Array.isArray(offlineRows) ? offlineRows.length > 0 : Boolean(offlineRows)
  if (!hasOfflineRow) {
    return { ok: false, reason: 'state_changed' }
  }

  await closePendingShiftPostsForShiftIds(
    supabase,
    ((currentShifts ?? []) as Array<{ id: string | null }>)
      .map((shift) => shift.id)
      .filter((id): id is string => Boolean(id)),
    OFFLINE_SHIFT_BOARD_CLOSURE_REASON
  )

  await writeAuditLog(supabase, {
    userId: actorId,
    action: 'schedule_block_taken_offline',
    targetType: 'schedule_cycle',
    targetId: cycleId,
  })

  return { ok: true }
}

export async function archiveScheduleBlockLifecycle(params: {
  supabase: ServerSupabaseClient
  actorId: string
  managerSiteId: string | null | undefined
  cycleId: string
  now?: () => string
}): Promise<ArchiveScheduleBlockLifecycleResult> {
  const { supabase, actorId, managerSiteId, cycleId, now = () => new Date().toISOString() } = params

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, published, archived_at, site_id, status')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    return { ok: false, reason: 'cycle_lookup_failed', error: cycleError }
  }

  const lifecycleCycle = cycle as ArchiveScheduleBlockLifecycleRow
  if (lifecycleCycle.published) {
    return { ok: false, reason: 'live' }
  }

  if (!managerSiteId || lifecycleCycle.site_id !== managerSiteId) {
    return { ok: false, reason: 'outside_site' }
  }

  if (lifecycleCycle.archived_at || lifecycleCycle.status === 'archived') {
    return { ok: true }
  }

  const { error: archiveError } = await supabase
    .from('schedule_cycles')
    .update({ archived_at: now(), status: 'archived' })
    .eq('id', cycleId)

  if (archiveError) {
    return { ok: false, reason: 'mutation_failed', error: archiveError }
  }

  await writeAuditLog(supabase, {
    userId: actorId,
    action: 'schedule_block_archived',
    targetType: 'schedule_cycle',
    targetId: cycleId,
  })

  return { ok: true }
}
