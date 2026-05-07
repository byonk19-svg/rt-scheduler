import type { SupabaseClient } from '@supabase/supabase-js'

export type MyScheduleShiftRow = {
  id: string
  cycle_id: string
  user_id?: string | null
  date: string
  shift_type: string
  role: string | null
  status: string
  assignment_status: string | null
  schedule_cycles: { published: boolean } | { published: boolean }[] | null
}

export type MyScheduleTeamShiftRow = MyScheduleShiftRow & {
  user_id: string | null
  profiles:
    | {
        full_name: string | null
        role: string | null
        is_lead_eligible?: boolean | null
      }
    | {
        full_name: string | null
        role: string | null
        is_lead_eligible?: boolean | null
      }[]
    | null
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

/** Published schedule rows in a date window, including teammates for roster-style personal views. */
export async function fetchPublishedScheduleWindow(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<MyScheduleTeamShiftRow[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select(
      'id, cycle_id, user_id, date, shift_type, role, status, assignment_status, schedule_cycles!shifts_cycle_id_fkey!inner(published), profiles:profiles!shifts_user_id_fkey(full_name, role, is_lead_eligible)'
    )
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('schedule_cycles.published', true)
    .not('user_id', 'is', null)
    .not('status', 'eq', 'called_off')
    .order('date', { ascending: true })

  if (error) {
    console.error('fetchPublishedScheduleWindow:', error)
    return []
  }

  return ((data ?? []) as MyScheduleTeamShiftRow[]).filter(
    (row) => row.assignment_status !== 'cancelled'
  )
}
