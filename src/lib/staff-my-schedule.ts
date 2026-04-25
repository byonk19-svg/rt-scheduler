import type { SupabaseClient } from '@supabase/supabase-js'

export type MyScheduleShiftRow = {
  id: string
  cycle_id: string
  date: string
  shift_type: string
  role: string | null
  status: string
  assignment_status: string | null
  schedule_cycles: { published: boolean } | { published: boolean }[] | null
}

const MS_PER_DAY = 86_400_000

/** Week bucket per spec: Math.floor(daysSinceEpoch / 7) with epoch days from UTC ms. */
export function weekBucketFromIsoDate(date: string): number {
  const ms = new Date(`${date}T12:00:00`).getTime()
  if (Number.isNaN(ms)) return 0
  const daysSinceEpoch = Math.floor(ms / MS_PER_DAY)
  return Math.floor(daysSinceEpoch / 7)
}

/** Upcoming shifts for the current user only, published cycles only. */
export async function fetchMyPublishedUpcomingShifts(
  supabase: SupabaseClient,
  userId: string,
  limit: number
): Promise<MyScheduleShiftRow[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('shifts')
    .select(
      'id, cycle_id, date, shift_type, role, status, assignment_status, schedule_cycles!shifts_cycle_id_fkey!inner(published)'
    )
    .eq('user_id', userId)
    .gte('date', today)
    .eq('schedule_cycles.published', true)
    .not('status', 'eq', 'called_off')
    .neq('assignment_status', 'cancelled')
    .order('date', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('fetchMyPublishedUpcomingShifts:', error)
    return []
  }

  return (data ?? []) as MyScheduleShiftRow[]
}
