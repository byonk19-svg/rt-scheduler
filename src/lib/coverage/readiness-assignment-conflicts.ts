import type {
  IneligibleAssignmentReadinessInput,
  IneligibleAssignmentReason,
} from '@/lib/coverage/readiness-issues'

type QueryResult = PromiseLike<{ data: unknown; error: unknown }>

type QueryFilterBuilder = QueryResult & {
  eq: (column: string, value: unknown) => QueryFilterBuilder
  in: (column: string, values: unknown[]) => QueryFilterBuilder
}

export type ReadinessAssignmentConflictClient = {
  from: (table: string) => {
    select: (columns: string) => QueryFilterBuilder
  }
}

export type AssignmentConflictShiftRow = {
  id: string | null
  user_id: string | null
  date: string | null
  shift_type: 'day' | 'night' | null
}

export type AssignmentConflictProfileRow = {
  id: string
  full_name: string | null
  is_active: boolean | null
  on_fmla: boolean | null
  archived_at: string | null
}

function resolveIneligibleAssignmentReason(
  profile: AssignmentConflictProfileRow
): IneligibleAssignmentReason | null {
  if (profile.archived_at) return 'archived'
  if (profile.is_active === false) return 'inactive'
  if (profile.on_fmla === true) return 'fmla'
  return null
}

export function buildIneligibleAssignmentReadinessInputs({
  shifts,
  profiles,
}: {
  shifts: readonly AssignmentConflictShiftRow[]
  profiles: readonly AssignmentConflictProfileRow[]
}): IneligibleAssignmentReadinessInput[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const conflicts: IneligibleAssignmentReadinessInput[] = []

  for (const shift of shifts) {
    if (!shift.id || !shift.user_id || !shift.date || !shift.shift_type) continue

    const profile = profileById.get(shift.user_id)
    if (!profile) continue

    const reason = resolveIneligibleAssignmentReason(profile)
    if (!reason) continue

    conflicts.push({
      shiftId: shift.id,
      therapistId: profile.id,
      therapistName: profile.full_name,
      date: shift.date,
      shiftType: shift.shift_type,
      reason,
    })
  }

  return conflicts.sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date)
    if (left.shiftType !== right.shiftType) return left.shiftType.localeCompare(right.shiftType)
    return left.shiftId.localeCompare(right.shiftId)
  })
}

export async function loadIneligibleAssignmentReadinessInputsForCycle(
  supabase: ReadinessAssignmentConflictClient,
  cycleId: string
): Promise<{ data: IneligibleAssignmentReadinessInput[]; error: unknown | null }> {
  const { data: shiftData, error: shiftError } = await supabase
    .from('shifts')
    .select('id, user_id, date, shift_type')
    .eq('cycle_id', cycleId)

  if (shiftError) {
    return { data: [], error: shiftError }
  }

  const shifts = (shiftData ?? []) as AssignmentConflictShiftRow[]
  const assignedTherapistIds = Array.from(
    new Set(shifts.map((shift) => shift.user_id).filter((id): id is string => Boolean(id)))
  )

  if (assignedTherapistIds.length === 0) {
    return { data: [], error: null }
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, is_active, on_fmla, archived_at')
    .in('id', assignedTherapistIds)

  if (profileError) {
    return { data: [], error: profileError }
  }

  return {
    data: buildIneligibleAssignmentReadinessInputs({
      shifts,
      profiles: (profileData ?? []) as AssignmentConflictProfileRow[],
    }),
    error: null,
  }
}
