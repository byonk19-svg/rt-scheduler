import type { AssignmentStatus, ShiftStatus } from '@/app/schedule/types'
import type { CoverageAssignmentPayload } from '@/lib/coverage/updateAssignmentStatus'

export type CoverageMutationError = { code?: string; message?: string } | null

type SupabaseLike = {
  from: (table: string) => {
    insert: (value: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => PromiseLike<{ data: unknown; error: CoverageMutationError }>
      }
    }
    delete: () => {
      eq: (column: string, value: string) => PromiseLike<{ error: CoverageMutationError }>
    }
    update: (value: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: CoverageMutationError }>
    }
  }
}

export type AssignCoverageShiftParams = {
  cycleId: string
  userId: string
  isoDate: string
  shiftType: 'day' | 'night'
  role?: 'lead' | 'staff'
}

export type AssignedCoverageShiftRow = {
  id: string
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  assignment_status: AssignmentStatus | null
}

type CoverageApiErrorResponse = {
  error?: string
  code?: string
  shift?: AssignedCoverageShiftRow
}

export async function assignCoverageShift(
  supabase: SupabaseLike,
  params: AssignCoverageShiftParams
): Promise<{ data: AssignedCoverageShiftRow | null; error: CoverageMutationError }> {
  const { data, error } = await supabase
    .from('shifts')
    .insert({
      cycle_id: params.cycleId,
      user_id: params.userId,
      date: params.isoDate,
      shift_type: params.shiftType,
      role: params.role ?? 'staff',
      status: 'scheduled',
    })
    .select('id, user_id, date, shift_type, status, assignment_status')
    .single()

  return {
    data: (data ?? null) as AssignedCoverageShiftRow | null,
    error,
  }
}

export async function unassignCoverageShift(
  supabase: SupabaseLike,
  shiftId: string
): Promise<{ error: CoverageMutationError }> {
  return await supabase.from('shifts').delete().eq('id', shiftId)
}

export async function assignCoverageShiftViaApi(
  params: AssignCoverageShiftParams
): Promise<{ data: AssignedCoverageShiftRow | null; error: CoverageMutationError }> {
  const response = await fetch('/api/schedule/drag-drop', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action: 'assign',
      cycleId: params.cycleId,
      userId: params.userId,
      date: params.isoDate,
      shiftType: params.shiftType,
      role: params.role ?? 'staff',
      overrideWeeklyRules: false,
    }),
  })

  const payload = (await response.json().catch(() => null)) as CoverageApiErrorResponse | null
  if (!response.ok) {
    return {
      data: null,
      error: {
        code: payload?.code,
        message: payload?.error ?? 'Could not assign therapist.',
      },
    }
  }

  return {
    data: (payload?.shift ?? null) as AssignedCoverageShiftRow | null,
    error: null,
  }
}

export async function unassignCoverageShiftViaApi(params: {
  cycleId: string
  shiftId: string
}): Promise<{ error: CoverageMutationError }> {
  const response = await fetch('/api/schedule/drag-drop', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action: 'remove',
      cycleId: params.cycleId,
      shiftId: params.shiftId,
    }),
  })

  if (response.ok) {
    return { error: null }
  }

  const payload = (await response.json().catch(() => null)) as CoverageApiErrorResponse | null
  return {
    error: {
      code: payload?.code,
      message: payload?.error ?? 'Could not remove shift.',
    },
  }
}

export async function persistCoverageShiftStatus(
  _supabase: SupabaseLike,
  shiftId: string,
  payload: CoverageAssignmentPayload
): Promise<{ error: CoverageMutationError }> {
  const response = await fetch('/api/schedule/assignment-status', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      assignmentId: shiftId,
      status: payload.assignment_status,
    }),
  })

  if (response.ok) {
    return { error: null }
  }

  const payloadBody = (await response.json().catch(() => null)) as CoverageApiErrorResponse | null
  return {
    error: {
      code: payloadBody?.code,
      message: payloadBody?.error ?? 'Could not save assignment status.',
    },
  }
}
