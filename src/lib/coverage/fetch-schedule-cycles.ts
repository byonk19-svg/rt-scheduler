import type { SupabaseClient } from '@supabase/supabase-js'

export type CoverageScheduleCycleRow = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
  status: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
  archived_at: string | null
  offline_at: string | null
  offline_by: string | null
}

/**
 * True when the failure is specifically about newer Schedule Block lifecycle columns missing from
 * the database (migration not applied) or from PostgREST's schema cache (PGRST204 after schema drift).
 */
export function isScheduleCycleArchivalColumnError(err: {
  message?: string
  code?: string
} | null): boolean {
  if (!err) return false
  const msg = String(err.message ?? '')
  const code = String(err.code ?? '')
  if (!/(archived_at|status|offline_at|offline_by)/i.test(msg)) return false
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    /column[^\n]*(archived_at|status|offline_at|offline_by)[^\n]*does not exist/i.test(msg) ||
    /could not find[^\n]*(archived_at|status|offline_at|offline_by)/i.test(msg)
  )
}

/**
 * Loads non-archived schedule cycles for Schedule. If the DB has not received the lifecycle
 * migrations yet, falls back to a legacy query (no archival/offline metadata).
 */
export async function fetchScheduleCyclesForCoverage(
  supabase: SupabaseClient
): Promise<{ data: CoverageScheduleCycleRow[]; error: { message: string; code?: string } | null }> {
  const primary = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published, status, archived_at, offline_at, offline_by')
    .is('archived_at', null)
    .order('start_date', { ascending: false })

  if (!primary.error) {
    return { data: (primary.data ?? []) as CoverageScheduleCycleRow[], error: null }
  }

  if (!isScheduleCycleArchivalColumnError(primary.error)) {
    return { data: [], error: primary.error }
  }

  const legacy = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published')
    .order('start_date', { ascending: false })

  if (legacy.error) {
    return { data: [], error: legacy.error }
  }

  const rows = (legacy.data ?? []) as Array<
    Omit<CoverageScheduleCycleRow, 'archived_at' | 'status' | 'offline_at' | 'offline_by'>
  >
  return {
    data: rows.map((r) => ({ ...r, status: null, archived_at: null, offline_at: null, offline_by: null })),
    error: null,
  }
}
