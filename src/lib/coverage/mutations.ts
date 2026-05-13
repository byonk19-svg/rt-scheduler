import type { AssignmentStatus, ShiftStatus } from '@/app/schedule/types'
import type { CoverageAssignmentPayload } from '@/lib/coverage/updateAssignmentStatus'

export type CoverageMutationError = { code?: string; message?: string } | null

export type AssignCoverageShiftParams = {
  cycleId: string
  userId: string
  isoDate: string
  shiftType: 'day' | 'night'
  role?: 'lead' | 'staff'
  availabilityOverride?: boolean
  availabilityOverrideReason?: string
}

export type AssignedCoverageShiftRow = {
  id: string
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  assignment_status: AssignmentStatus | null
}

export type CoverageMutationResult<T = null> = {
  data: T | null
  error: CoverageMutationError
}

export type CoverageShiftMutator = {
  assign: (params: AssignCoverageShiftParams) => Promise<CoverageMutationResult<AssignedCoverageShiftRow>>
  unassign: (params: { cycleId: string; shiftId: string }) => Promise<{ error: CoverageMutationError }>
  setDesignatedLead: (
    params: SetCoverageDesignatedLeadParams
  ) => Promise<{ error: CoverageMutationError }>
  updateStatus: (
    shiftId: string,
    payload: CoverageAssignmentPayload
  ) => Promise<{ error: CoverageMutationError }>
}

type CoverageApiErrorResponse = {
  error?: string
  code?: string
  shift?: AssignedCoverageShiftRow
}

async function postCoverageMutation<T = null>(params: {
  url: '/api/schedule/drag-drop' | '/api/schedule/assignment-status'
  body: Record<string, unknown>
  fallbackMessage: string
  readData?: (payload: CoverageApiErrorResponse | null) => T | null
}): Promise<CoverageMutationResult<T>> {
  const response = await fetch(params.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(params.body),
  })

  const payload = (await response.json().catch(() => null)) as CoverageApiErrorResponse | null
  if (!response.ok) {
    return {
      data: null,
      error: {
        code: payload?.code,
        message: payload?.error ?? params.fallbackMessage,
      },
    }
  }

  return {
    data: params.readData?.(payload) ?? null,
    error: null,
  }
}

async function assignCoverageShiftViaApi(
  params: AssignCoverageShiftParams
): Promise<{ data: AssignedCoverageShiftRow | null; error: CoverageMutationError }> {
  return postCoverageMutation({
    url: '/api/schedule/drag-drop',
    fallbackMessage: 'Could not assign therapist.',
    body: {
      action: 'assign',
      cycleId: params.cycleId,
      userId: params.userId,
      date: params.isoDate,
      shiftType: params.shiftType,
      role: params.role ?? 'staff',
      overrideWeeklyRules: false,
      availabilityOverride: params.availabilityOverride === true,
      availabilityOverrideReason: params.availabilityOverrideReason,
    },
    readData: (payload) => payload?.shift ?? null,
  })
}

export type SetCoverageDesignatedLeadParams = {
  cycleId: string
  therapistId: string
  isoDate: string
  shiftType: 'day' | 'night'
}

/** Calls drag-drop `set_lead` — promotes an existing slot or swaps designated lead. */
async function setCoverageDesignatedLeadViaApi(
  params: SetCoverageDesignatedLeadParams
): Promise<{ error: CoverageMutationError }> {
  const result = await postCoverageMutation({
    url: '/api/schedule/drag-drop',
    fallbackMessage: 'Could not update designated lead.',
    body: {
      action: 'set_lead',
      cycleId: params.cycleId,
      therapistId: params.therapistId,
      date: params.isoDate,
      shiftType: params.shiftType,
      overrideWeeklyRules: false,
    },
  })

  return { error: result.error }
}

async function unassignCoverageShiftViaApi(params: {
  cycleId: string
  shiftId: string
}): Promise<{ error: CoverageMutationError }> {
  const result = await postCoverageMutation({
    url: '/api/schedule/drag-drop',
    fallbackMessage: 'Could not remove shift.',
    body: {
      action: 'remove',
      cycleId: params.cycleId,
      shiftId: params.shiftId,
    },
  })

  return { error: result.error }
}

async function persistCoverageShiftStatus(
  shiftId: string,
  payload: CoverageAssignmentPayload
): Promise<{ error: CoverageMutationError }> {
  const result = await postCoverageMutation({
    url: '/api/schedule/assignment-status',
    fallbackMessage: 'Could not save assignment status.',
    body: {
      assignmentId: shiftId,
      status: payload.assignment_status,
    },
  })

  return { error: result.error }
}

export function createCoverageShiftMutator(): CoverageShiftMutator {
  return {
    assign: assignCoverageShiftViaApi,
    unassign: unassignCoverageShiftViaApi,
    setDesignatedLead: setCoverageDesignatedLeadViaApi,
    updateStatus: persistCoverageShiftStatus,
  }
}
