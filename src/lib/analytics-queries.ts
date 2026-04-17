import { getAutoDraftCoveragePolicy } from '@/lib/coverage/auto-draft-policy'

type SupabaseClientLike = {
  from: (table: string) => {
    select: (columns?: string, options?: { count?: 'exact'; head?: boolean }) => unknown
  }
}

type CycleWithShiftsRow = {
  id: string
  label: string
  start_date: string
  end_date: string
  shifts:
    | {
        status: string | null
        shift_type: 'day' | 'night' | null
      }[]
    | null
}

type SubmissionRow = {
  cycle_id: string
  therapist_id: string
  submitted_at: string
}

type CycleLabelRow = {
  id: string
  label: string
}

type ForceOnOverrideRow = {
  therapist_id: string
  date: string
  cycle_id: string
  profiles: { full_name: string | null } | { full_name: string | null }[] | null
  schedule_cycles: { label: string | null } | { label: string | null }[] | null
}

type ShiftMatchRow = {
  user_id: string | null
  date: string
}

type CycleFillRateQuery = {
  select: (columns: string) => {
    order: (
      column: string,
      options: { ascending: boolean }
    ) => {
      limit: (count: number) => Promise<{ data: CycleWithShiftsRow[] | null }>
    }
  }
}

type ActiveTherapistCountQuery = {
  select: (
    columns: string,
    options: { count: 'exact' }
  ) => {
    in: (
      column: string,
      values: string[]
    ) => {
      eq: (column: string, value: boolean) => Promise<{ count: number | null }>
    }
  }
}

type SubmissionQuery = {
  select: (columns: string) => {
    order: (column: string) => Promise<{ data: SubmissionRow[] | null }>
  }
}

type CycleLabelQuery = {
  select: (columns: string) => {
    in: (column: string, values: string[]) => Promise<{ data: CycleLabelRow[] | null }>
  }
}

type ForceOnOverrideQuery = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string
    ) => {
      order: (column: string) => Promise<{ data: ForceOnOverrideRow[] | null }>
    }
  }
}

type ShiftMatchQuery = {
  select: (columns: string) => {
    in: (
      column: string,
      values: string[]
    ) => {
      in: (column: string, values: string[]) => Promise<{ data: ShiftMatchRow[] | null }>
    }
  }
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function getInclusiveDayCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0
  const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return diffDays + 1
}

export async function getCycleFillRates(supabase: SupabaseClientLike) {
  const { idealCoveragePerShift } = getAutoDraftCoveragePolicy()
  const result = await (supabase.from('schedule_cycles') as unknown as CycleFillRateQuery)
    .select('id, label, start_date, end_date, shifts(status, shift_type)')
    .order('start_date', { ascending: false })
    .limit(10)

  return (result.data ?? []).map((cycle) => {
    const scheduledCount = cycle.shifts?.filter((shift) => shift.status === 'scheduled').length ?? 0
    const dayCount = getInclusiveDayCount(cycle.start_date, cycle.end_date)
    const totalSlots = idealCoveragePerShift * dayCount * 2
    const fillPercent = totalSlots > 0 ? Math.round((scheduledCount / totalSlots) * 100) : 0

    return {
      cycleId: cycle.id,
      label: cycle.label,
      dateRange: `${cycle.start_date} to ${cycle.end_date}`,
      fillPercent,
      scheduledCount,
      totalSlots,
    }
  })
}

export async function getSubmissionCompliance(supabase: SupabaseClientLike) {
  const activeCountResult = await (
    supabase.from('profiles') as unknown as ActiveTherapistCountQuery
  )
    .select('id', { count: 'exact' })
    .in('role', ['therapist', 'lead'])
    .eq('is_active', true)

  const totalActive = activeCountResult.count ?? 0

  const submissionResult = await (
    supabase.from('therapist_availability_submissions') as unknown as SubmissionQuery
  )
    .select('cycle_id, therapist_id, submitted_at')
    .order('cycle_id')

  const submissions = submissionResult.data ?? []
  const cycleIds = [...new Set(submissions.map((row) => row.cycle_id))]

  const cycleLabelsResult =
    cycleIds.length > 0
      ? await (supabase.from('schedule_cycles') as unknown as CycleLabelQuery)
          .select('id, label')
          .in('id', cycleIds)
      : { data: [] as CycleLabelRow[] | null }

  const labelsByCycleId = new Map((cycleLabelsResult.data ?? []).map((row) => [row.id, row.label]))

  const submittedByCycleId = new Map<string, Set<string>>()
  for (const row of submissions) {
    const submittedSet = submittedByCycleId.get(row.cycle_id) ?? new Set<string>()
    submittedSet.add(row.therapist_id)
    submittedByCycleId.set(row.cycle_id, submittedSet)
  }

  return [...submittedByCycleId.entries()].map(([cycleId, therapistIds]) => ({
    cycleId,
    label: labelsByCycleId.get(cycleId) ?? cycleId,
    submittedCount: therapistIds.size,
    totalActive,
    compliancePercent: totalActive > 0 ? Math.round((therapistIds.size / totalActive) * 100) : 0,
  }))
}

export async function getForcedDateMisses(supabase: SupabaseClientLike) {
  const overrideResult = await (
    supabase.from('availability_overrides') as unknown as ForceOnOverrideQuery
  )
    .select(
      'therapist_id, date, cycle_id, profiles!availability_overrides_therapist_id_fkey(full_name), schedule_cycles(label)'
    )
    .eq('override_type', 'force_on')
    .order('cycle_id')

  const overrides = overrideResult.data ?? []
  const therapistIds = [...new Set(overrides.map((row) => row.therapist_id))]
  const dates = [...new Set(overrides.map((row) => row.date))]

  const shiftsResult =
    therapistIds.length > 0 && dates.length > 0
      ? await (supabase.from('shifts') as unknown as ShiftMatchQuery)
          .select('user_id, date')
          .in('user_id', therapistIds)
          .in('date', dates)
      : { data: [] as ShiftMatchRow[] | null }

  const matchingShiftKeys = new Set(
    (shiftsResult.data ?? [])
      .filter((row) => Boolean(row.user_id))
      .map((row) => `${row.user_id}:${row.date}`)
  )

  return overrides.map((override) => ({
    therapistName: getOne(override.profiles)?.full_name ?? 'Unknown therapist',
    date: override.date,
    cycleLabel: getOne(override.schedule_cycles)?.label ?? override.cycle_id,
    missed: !matchingShiftKeys.has(`${override.therapist_id}:${override.date}`),
  }))
}
