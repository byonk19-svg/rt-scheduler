import type { AvailabilityCycle, AvailabilityOverrideRow } from '@/lib/availability-page-data'

export const AVAILABILITY_CYCLE_SELECT =
  'id, label, start_date, end_date, published, archived_at, availability_due_at'

export const AVAILABILITY_ENTRY_SELECT =
  'id, date, shift_type, override_type, note, created_at, updated_at, source, therapist_id, cycle_id, profiles!availability_overrides_therapist_id_fkey(full_name), schedule_cycles(label, start_date, end_date)'

type SupabaseLike = {
  from: (table: string) => {
    select: (selection: string) => SupabaseQueryLike
  }
}

type SupabaseQueryLike = PromiseLike<{ data?: unknown }> & {
  eq: (column: string, value: unknown) => SupabaseQueryLike
  gte: (column: string, value: unknown) => SupabaseQueryLike
  in: (column: string, values: unknown[]) => SupabaseQueryLike
  is: (column: string, value: unknown) => SupabaseQueryLike
  order: (column: string, options?: Record<string, unknown>) => SupabaseQueryLike
}

export async function fetchAvailabilityCycles(
  supabase: SupabaseLike,
  todayKey: string
): Promise<AvailabilityCycle[]> {
  const query = supabase
    .from('schedule_cycles')
    .select(AVAILABILITY_CYCLE_SELECT)
    .is('archived_at', null)
    .gte('end_date', todayKey)
    .order('start_date', { ascending: true })

  const result = await query
  return (result.data ?? []) as AvailabilityCycle[]
}

export async function fetchAvailabilityEntries(params: {
  supabase: SupabaseLike
  selectedCycleId: string
  therapistId?: string
}): Promise<AvailabilityOverrideRow[]> {
  let query = params.supabase.from('availability_overrides').select(AVAILABILITY_ENTRY_SELECT)

  if (params.therapistId) {
    query = query.eq('therapist_id', params.therapistId)
  }
  if (params.selectedCycleId) {
    query = query.eq('cycle_id', params.selectedCycleId)
  }

  query = query.order('date', { ascending: true }).order('created_at', { ascending: false })

  const result = await query
  return (result.data ?? []) as AvailabilityOverrideRow[]
}

export async function fetchAvailabilitySubmissionRows(params: {
  supabase: SupabaseLike
  therapistId: string
  cycleIds: string[]
}): Promise<Array<{ schedule_cycle_id: string; submitted_at: string; last_edited_at: string }>> {
  if (params.cycleIds.length === 0) return []

  const query = params.supabase
    .from('therapist_availability_submissions')
    .select('schedule_cycle_id, submitted_at, last_edited_at')
    .eq('therapist_id', params.therapistId)
    .in('schedule_cycle_id', params.cycleIds)

  const result = await query
  return (result.data ?? []) as Array<{
    schedule_cycle_id: string
    submitted_at: string
    last_edited_at: string
  }>
}

export async function fetchManagerPlannerOverrides(
  supabase: SupabaseLike,
  cycleIds: string[]
): Promise<
  Array<{
    id: string
    therapist_id: string
    cycle_id: string
    date: string
    shift_type: 'day' | 'night' | 'both'
    override_type: 'force_off' | 'force_on'
    note: string | null
    source: 'manager' | 'therapist'
  }>
> {
  if (cycleIds.length === 0) return []

  const query = supabase
    .from('availability_overrides')
    .select('id, therapist_id, cycle_id, date, shift_type, override_type, note, source')
    .eq('source', 'manager')
    .in('cycle_id', cycleIds)
    .order('date', { ascending: true })

  const result = await query
  return (result.data ?? []) as Array<{
    id: string
    therapist_id: string
    cycle_id: string
    date: string
    shift_type: 'day' | 'night' | 'both'
    override_type: 'force_off' | 'force_on'
    note: string | null
    source: 'manager' | 'therapist'
  }>
}
