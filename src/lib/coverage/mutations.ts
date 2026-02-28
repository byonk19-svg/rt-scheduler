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

export async function persistCoverageShiftStatus(
  supabase: SupabaseLike,
  shiftId: string,
  payload: CoverageAssignmentPayload
): Promise<{ error: CoverageMutationError }> {
  return await supabase
    .from('shifts')
    .update({
      assignment_status: payload.assignment_status,
      status: payload.status,
    })
    .eq('id', shiftId)
}
