import { toPreliminaryStateFromShift } from '@/lib/preliminary-schedule/selectors'
import type {
  PreliminaryDirectEditAction,
  CancelPreliminaryRequestParams,
  PreliminaryRequestRow,
  PreliminaryShiftRow,
  PreliminaryShiftStateRow,
  PreliminarySnapshotRow,
  RefreshPreliminarySnapshotParams,
  ReviewPreliminaryRequestParams,
  SendPreliminarySnapshotParams,
  SubmitPreliminaryRequestParams,
} from '@/lib/preliminary-schedule/types'

type PreliminaryMutationErrorCode =
  | 'active_snapshot_not_found'
  | 'shift_state_not_found'
  | 'slot_already_reserved'
  | 'not_open_shift'
  | 'not_shift_owner'
  | 'not_request_owner'
  | 'request_not_found'
  | 'request_not_pending'
  | 'action_not_allowed'
  | 'database_error'

export type PreliminaryMutationError = {
  code: PreliminaryMutationErrorCode
  message: string
}

type MutationResult<T> = {
  data: T | null
  error: PreliminaryMutationError | null
}

type QueryError = { message?: string } | null
type QueryResult<T> = Promise<{ data: T; error: QueryError }>
type QueryBuilder<T> = {
  eq: (column: string, value: unknown) => QueryBuilder<T>
  maybeSingle: () => QueryResult<T | null>
}

type SupabaseLike = {
  from: (table: string) => {
    select: (...args: unknown[]) => QueryBuilder<unknown>
    insert: (payload: Record<string, unknown> | Array<Record<string, unknown>>) => {
      select: () => {
        single: () => Promise<{ data: unknown; error: QueryError }>
      }
    }
    upsert: (
      payload: Array<Record<string, unknown>>,
      options?: Record<string, unknown>
    ) => Promise<{ data: unknown; error: QueryError }>
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => Promise<{ data: unknown; error: QueryError }>
    }
    delete: () => {
      eq: (column: string, value: unknown) => Promise<{ error: QueryError }>
    }
  }
}

function mutationError(
  code: PreliminaryMutationErrorCode,
  message: string
): PreliminaryMutationError {
  return { code, message }
}

function nowIso(): string {
  return new Date().toISOString()
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `prelim-${Date.now()}-${Math.random()}`
}

async function getActiveSnapshot(
  supabase: SupabaseLike,
  cycleId: string
): Promise<{ data: PreliminarySnapshotRow | null; error: PreliminaryMutationError | null }> {
  const { data, error } = (await supabase
    .from('preliminary_snapshots')
    .select('*')
    .eq('cycle_id', cycleId)
    .eq('status', 'active')
    .maybeSingle()) as {
    data: PreliminarySnapshotRow | null
    error: QueryError
  }

  if (error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        error.message ?? 'Could not load preliminary snapshot.'
      ),
    }
  }

  return { data, error: null }
}

function buildShiftStateRows(
  snapshotId: string,
  shifts: PreliminaryShiftRow[]
): PreliminaryShiftStateRow[] {
  const updatedAt = nowIso()
  return shifts.map((shift) => ({
    id: newId(),
    snapshot_id: snapshotId,
    shift_id: shift.id,
    state: toPreliminaryStateFromShift(shift),
    reserved_by: shift.user_id,
    active_request_id: null,
    updated_at: updatedAt,
  }))
}

export async function refreshPreliminarySnapshot(
  supabase: SupabaseLike,
  params: RefreshPreliminarySnapshotParams
): Promise<MutationResult<{ snapshotId: string }>> {
  const deleted = await supabase
    .from('preliminary_shift_states')
    .delete()
    .eq('snapshot_id', params.snapshotId)
  if (deleted.error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        deleted.error.message ?? 'Could not clear preliminary shift states.'
      ),
    }
  }

  const rows = buildShiftStateRows(params.snapshotId, params.shifts)
  const { error } = await supabase
    .from('preliminary_shift_states')
    .upsert(rows as unknown as Array<Record<string, unknown>>, {
      onConflict: 'snapshot_id,shift_id',
    })

  if (error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        error.message ?? 'Could not seed preliminary shift states.'
      ),
    }
  }

  return {
    data: { snapshotId: params.snapshotId },
    error: null,
  }
}

export async function sendPreliminarySnapshot(
  supabase: SupabaseLike,
  params: SendPreliminarySnapshotParams
): Promise<MutationResult<PreliminarySnapshotRow>> {
  const existing = await getActiveSnapshot(supabase, params.cycleId)
  if (existing.error) return { data: null, error: existing.error }

  if (existing.data) {
    const updatedAt = nowIso()
    const updateResult = await supabase
      .from('preliminary_snapshots')
      .update({ sent_at: updatedAt })
      .eq('id', existing.data.id)

    if (updateResult.error) {
      return {
        data: null,
        error: mutationError(
          'database_error',
          updateResult.error.message ?? 'Could not update preliminary snapshot.'
        ),
      }
    }

    const refresh = await refreshPreliminarySnapshot(supabase, {
      snapshotId: existing.data.id,
      shifts: params.shifts,
    })

    if (refresh.error) return { data: null, error: refresh.error }

    return {
      data: {
        ...existing.data,
        sent_at: updatedAt,
      },
      error: null,
    }
  }

  const snapshot: PreliminarySnapshotRow = {
    id: newId(),
    cycle_id: params.cycleId,
    created_by: params.actorId,
    sent_at: nowIso(),
    status: 'active',
    created_at: nowIso(),
  }

  const inserted = await supabase
    .from('preliminary_snapshots')
    .insert(snapshot as unknown as Record<string, unknown>)
    .select()
    .single()

  if (inserted.error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        inserted.error.message ?? 'Could not create preliminary snapshot.'
      ),
    }
  }

  const refresh = await refreshPreliminarySnapshot(supabase, {
    snapshotId: snapshot.id,
    shifts: params.shifts,
  })

  if (refresh.error) return { data: null, error: refresh.error }

  return {
    data: snapshot,
    error: null,
  }
}

async function getShiftState(
  supabase: SupabaseLike,
  snapshotId: string,
  shiftId: string
): Promise<MutationResult<PreliminaryShiftStateRow>> {
  const builder = supabase
    .from('preliminary_shift_states')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .eq('shift_id', shiftId)
  const { data, error } = (await builder.maybeSingle()) as {
    data: PreliminaryShiftStateRow | null
    error: QueryError
  }

  if (error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        error.message ?? 'Could not load preliminary shift state.'
      ),
    }
  }

  if (!data) {
    return {
      data: null,
      error: mutationError('shift_state_not_found', 'Preliminary shift state not found.'),
    }
  }

  return { data, error: null }
}

async function getShift(
  supabase: SupabaseLike,
  shiftId: string
): Promise<MutationResult<PreliminaryShiftRow>> {
  const { data, error } = (await supabase
    .from('shifts')
    .select('*')
    .eq('id', shiftId)
    .maybeSingle()) as {
    data: PreliminaryShiftRow | null
    error: QueryError
  }

  if (error) {
    return {
      data: null,
      error: mutationError('database_error', error.message ?? 'Could not load shift.'),
    }
  }

  if (!data) {
    return {
      data: null,
      error: mutationError('shift_state_not_found', 'Underlying shift not found.'),
    }
  }

  return { data, error: null }
}

async function getProfile(
  supabase: SupabaseLike,
  requesterId: string
): Promise<
  MutationResult<{
    id: string
    role: string | null
    shift_type: 'day' | 'night' | null
    is_lead_eligible?: boolean | null
  }>
> {
  const { data, error } = (await supabase
    .from('profiles')
    .select('*')
    .eq('id', requesterId)
    .maybeSingle()) as {
    data: {
      id: string
      role: string | null
      shift_type: 'day' | 'night' | null
      is_lead_eligible?: boolean | null
    } | null
    error: QueryError
  }

  if (error) {
    return {
      data: null,
      error: mutationError('database_error', error.message ?? 'Could not load profile.'),
    }
  }

  if (!data) {
    return {
      data: null,
      error: mutationError('database_error', 'Could not load profile.'),
    }
  }

  return { data, error: null }
}

async function getUserShiftOnDate(
  supabase: SupabaseLike,
  params: {
    cycleId: string | null
    userId: string
    date: string
  }
): Promise<MutationResult<PreliminaryShiftRow | null>> {
  if (!params.cycleId) {
    return { data: null, error: null }
  }

  const { data, error } = (await supabase
    .from('shifts')
    .select('*')
    .eq('cycle_id', params.cycleId)
    .eq('user_id', params.userId)
    .eq('date', params.date)
    .maybeSingle()) as {
    data: PreliminaryShiftRow | null
    error: QueryError
  }

  if (error) {
    return {
      data: null,
      error: mutationError('database_error', error.message ?? 'Could not load shifts for date.'),
    }
  }

  return { data: data ?? null, error: null }
}

function buildRequest(
  params: SubmitPreliminaryRequestParams,
  type: PreliminaryRequestRow['type']
): Omit<PreliminaryRequestRow, 'requester_name'> {
  return {
    id: newId(),
    snapshot_id: params.snapshotId,
    shift_id: params.shiftId,
    requester_id: params.requesterId,
    type,
    status: 'pending',
    note: params.note?.trim() || null,
    decision_note: null,
    approved_by: null,
    approved_at: null,
    created_at: nowIso(),
  }
}

export async function applyDirectPreliminaryEdit(
  supabase: SupabaseLike,
  params: {
    snapshotId: string
    shiftId: string
    requesterId: string
    action: Extract<PreliminaryDirectEditAction, 'add_here' | 'remove_me'>
  }
): Promise<MutationResult<{ shiftId: string; action: 'add_here' | 'remove_me' }>> {
  const [shiftState, shift, profile] = await Promise.all([
    getShiftState(supabase, params.snapshotId, params.shiftId),
    getShift(supabase, params.shiftId),
    getProfile(supabase, params.requesterId),
  ])
  if (shiftState.error) return { data: null, error: shiftState.error }
  if (shift.error) return { data: null, error: shift.error }
  if (profile.error) return { data: null, error: profile.error }
  if (!shiftState.data || !shift.data || !profile.data) {
    return {
      data: null,
      error: mutationError('database_error', 'Could not load preliminary edit context.'),
    }
  }

  const currentShiftState = shiftState.data
  const currentShift = shift.data
  const currentProfile = profile.data

  if (params.action === 'remove_me') {
    if (
      currentShift.user_id !== params.requesterId ||
      currentShiftState.state !== 'tentative_assignment'
    ) {
      return {
        data: null,
        error: mutationError('action_not_allowed', 'Only your own tentative shift can be removed.'),
      }
    }

    const updatedShift = await supabase
      .from('shifts')
      .update({ user_id: null })
      .eq('id', currentShift.id)

    if (updatedShift.error) {
      return {
        data: null,
        error: mutationError(
          'database_error',
          updatedShift.error.message ?? 'Could not remove preliminary assignment.'
        ),
      }
    }

    const updatedShiftState = await supabase
      .from('preliminary_shift_states')
      .update({
        state: 'open',
        reserved_by: null,
        active_request_id: null,
        updated_at: nowIso(),
      })
      .eq('id', currentShiftState.id)

    if (updatedShiftState.error) {
      return {
        data: null,
        error: mutationError(
          'database_error',
          updatedShiftState.error.message ?? 'Could not reopen preliminary shift.'
        ),
      }
    }

    return { data: { shiftId: currentShift.id, action: 'remove_me' }, error: null }
  }

  if (currentProfile.shift_type && currentShift.shift_type !== currentProfile.shift_type) {
    return {
      data: null,
      error: mutationError(
        'action_not_allowed',
        'Only same-shift preliminary edits can be applied immediately.'
      ),
    }
  }

  if (currentShift.role === 'lead' && currentProfile.is_lead_eligible !== true) {
    return {
      data: null,
      error: mutationError(
        'action_not_allowed',
        'Only lead-eligible therapists can take this preliminary lead slot.'
      ),
    }
  }

  if (
    currentShiftState.state !== 'open' &&
    !(
      currentShiftState.state === 'tentative_assignment' &&
      currentShift.user_id !== params.requesterId
    )
  ) {
    return {
      data: null,
      error: mutationError(
        'action_not_allowed',
        'Only open or filled same-shift preliminary slots can be taken immediately.'
      ),
    }
  }

  const existingShiftOnDate = await getUserShiftOnDate(supabase, {
    cycleId: currentShift.cycle_id,
    userId: params.requesterId,
    date: currentShift.date,
  })
  if (existingShiftOnDate.error) return { data: null, error: existingShiftOnDate.error }
  if (existingShiftOnDate.data && existingShiftOnDate.data.id !== currentShift.id) {
    return {
      data: null,
      error: mutationError(
        'action_not_allowed',
        'You already have a preliminary shift on this date.'
      ),
    }
  }

  if (currentShiftState.state === 'open') {
    const updatedShift = await supabase
      .from('shifts')
      .update({ user_id: params.requesterId })
      .eq('id', currentShift.id)

    if (updatedShift.error) {
      return {
        data: null,
        error: mutationError(
          'database_error',
          updatedShift.error.message ?? 'Could not assign preliminary shift.'
        ),
      }
    }

    const updatedShiftState = await supabase
      .from('preliminary_shift_states')
      .update({
        state: 'tentative_assignment',
        reserved_by: params.requesterId,
        active_request_id: null,
        updated_at: nowIso(),
      })
      .eq('id', currentShiftState.id)

    if (updatedShiftState.error) {
      return {
        data: null,
        error: mutationError(
          'database_error',
          updatedShiftState.error.message ?? 'Could not update preliminary slot state.'
        ),
      }
    }

    return { data: { shiftId: currentShift.id, action: 'add_here' }, error: null }
  }

  const insertedShift = await supabase
    .from('shifts')
    .insert({
      cycle_id: currentShift.cycle_id,
      user_id: params.requesterId,
      date: currentShift.date,
      shift_type: currentShift.shift_type,
      status: currentShift.status,
      role: currentShift.role,
    })
    .select()
    .single()

  if (insertedShift.error || !insertedShift.data) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        insertedShift.error?.message ?? 'Could not add you to this preliminary shift.'
      ),
    }
  }

  const newShiftState: PreliminaryShiftStateRow = {
    id: newId(),
    snapshot_id: params.snapshotId,
    shift_id: (insertedShift.data as PreliminaryShiftRow).id,
    state: 'tentative_assignment',
    reserved_by: params.requesterId,
    active_request_id: null,
    updated_at: nowIso(),
  }

  const insertedShiftState = await supabase
    .from('preliminary_shift_states')
    .upsert([newShiftState as unknown as Record<string, unknown>], {
      onConflict: 'snapshot_id,shift_id',
    })

  if (insertedShiftState.error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        insertedShiftState.error.message ?? 'Could not add the new preliminary shift state.'
      ),
    }
  }

  return {
    data: { shiftId: (insertedShift.data as PreliminaryShiftRow).id, action: 'add_here' },
    error: null,
  }
}

export async function submitPreliminaryClaimRequest(
  supabase: SupabaseLike,
  params: SubmitPreliminaryRequestParams
): Promise<MutationResult<PreliminaryRequestRow>> {
  const shiftState = await getShiftState(supabase, params.snapshotId, params.shiftId)
  if (shiftState.error) return { data: null, error: shiftState.error }
  if (!shiftState.data) {
    return {
      data: null,
      error: mutationError('shift_state_not_found', 'Preliminary shift state not found.'),
    }
  }
  const currentShiftState = shiftState.data

  if (currentShiftState.state !== 'open') {
    return {
      data: null,
      error: mutationError('slot_already_reserved', 'This slot is no longer open.'),
    }
  }

  const request = buildRequest(params, 'claim_open_shift')
  const inserted = await supabase
    .from('preliminary_requests')
    .insert(request as unknown as Record<string, unknown>)
    .select()
    .single()

  if (inserted.error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        inserted.error.message ?? 'Could not create preliminary claim request.'
      ),
    }
  }

  const updatedShiftState = await supabase
    .from('preliminary_shift_states')
    .update({
      state: 'pending_claim',
      reserved_by: params.requesterId,
      active_request_id: request.id,
      updated_at: nowIso(),
    })
    .eq('id', currentShiftState.id)

  if (updatedShiftState.error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        updatedShiftState.error.message ?? 'Could not reserve preliminary slot.'
      ),
    }
  }

  return { data: { ...request, requester_name: null }, error: null }
}

export async function submitPreliminaryChangeRequest(
  supabase: SupabaseLike,
  params: SubmitPreliminaryRequestParams
): Promise<MutationResult<PreliminaryRequestRow>> {
  const shiftState = await getShiftState(supabase, params.snapshotId, params.shiftId)
  if (shiftState.error) return { data: null, error: shiftState.error }

  const shift = await getShift(supabase, params.shiftId)
  if (shift.error) return { data: null, error: shift.error }
  if (!shiftState.data || !shift.data) {
    return {
      data: null,
      error: mutationError('shift_state_not_found', 'Preliminary shift state not found.'),
    }
  }
  const currentShiftState = shiftState.data
  const currentShift = shift.data

  if (
    currentShift.user_id !== params.requesterId ||
    currentShiftState.state !== 'tentative_assignment'
  ) {
    return {
      data: null,
      error: mutationError('not_shift_owner', 'Only the assigned therapist can request a change.'),
    }
  }

  const request = buildRequest(params, 'request_change')
  const inserted = await supabase
    .from('preliminary_requests')
    .insert(request as unknown as Record<string, unknown>)
    .select()
    .single()

  if (inserted.error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        inserted.error.message ?? 'Could not create preliminary change request.'
      ),
    }
  }

  const updatedShiftState = await supabase
    .from('preliminary_shift_states')
    .update({
      state: 'pending_change',
      active_request_id: request.id,
      updated_at: nowIso(),
    })
    .eq('id', currentShiftState.id)

  if (updatedShiftState.error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        updatedShiftState.error.message ?? 'Could not flag preliminary shift as pending change.'
      ),
    }
  }

  return { data: { ...request, requester_name: null }, error: null }
}

async function getRequest(
  supabase: SupabaseLike,
  requestId: string
): Promise<MutationResult<PreliminaryRequestRow>> {
  const { data, error } = (await supabase
    .from('preliminary_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()) as {
    data: PreliminaryRequestRow | null
    error: QueryError
  }

  if (error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        error.message ?? 'Could not load preliminary request.'
      ),
    }
  }

  if (!data) {
    return {
      data: null,
      error: mutationError('request_not_found', 'Preliminary request not found.'),
    }
  }

  return { data, error: null }
}

async function reviewPreliminaryRequest(
  supabase: SupabaseLike,
  params: ReviewPreliminaryRequestParams,
  nextStatus: 'approved' | 'denied'
): Promise<MutationResult<PreliminaryRequestRow>> {
  const request = await getRequest(supabase, params.requestId)
  if (request.error) return { data: null, error: request.error }
  if (!request.data) {
    return {
      data: null,
      error: mutationError('request_not_found', 'Preliminary request not found.'),
    }
  }
  const currentRequest = request.data

  if (currentRequest.status !== 'pending') {
    return {
      data: null,
      error: mutationError('request_not_pending', 'Only pending requests can be reviewed.'),
    }
  }

  const shiftState = await getShiftState(
    supabase,
    currentRequest.snapshot_id,
    currentRequest.shift_id
  )
  if (shiftState.error) return { data: null, error: shiftState.error }
  if (!shiftState.data) {
    return {
      data: null,
      error: mutationError('shift_state_not_found', 'Preliminary shift state not found.'),
    }
  }
  const currentShiftState = shiftState.data

  const approvedAt = nowIso()
  const updatedRequestPayload = {
    status: nextStatus,
    decision_note: params.decisionNote?.trim() || null,
    approved_by: params.actorId,
    approved_at: approvedAt,
  }

  const updatedRequest = await supabase
    .from('preliminary_requests')
    .update(updatedRequestPayload)
    .eq('id', currentRequest.id)

  if (updatedRequest.error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        updatedRequest.error.message ?? 'Could not review preliminary request.'
      ),
    }
  }

  if (currentRequest.type === 'claim_open_shift') {
    const shiftUpdate = await supabase
      .from('shifts')
      .update({ user_id: nextStatus === 'approved' ? currentRequest.requester_id : null })
      .eq('id', currentRequest.shift_id)

    if (shiftUpdate.error) {
      return {
        data: null,
        error: mutationError(
          'database_error',
          shiftUpdate.error.message ?? 'Could not sync the preliminary claim to the schedule.'
        ),
      }
    }
  }

  if (currentRequest.type === 'request_change' && nextStatus === 'approved') {
    const shiftUpdate = await supabase
      .from('shifts')
      .update({ user_id: null })
      .eq('id', currentRequest.shift_id)

    if (shiftUpdate.error) {
      return {
        data: null,
        error: mutationError(
          'database_error',
          shiftUpdate.error.message ?? 'Could not sync the preliminary change to the schedule.'
        ),
      }
    }
  }

  let shiftStatePayload: Partial<PreliminaryShiftStateRow> | null = null
  if (currentRequest.type === 'claim_open_shift') {
    shiftStatePayload =
      nextStatus === 'approved'
        ? {
            state: 'tentative_assignment',
            reserved_by: currentRequest.requester_id,
            active_request_id: null,
            updated_at: approvedAt,
          }
        : {
            state: 'open',
            reserved_by: null,
            active_request_id: null,
            updated_at: approvedAt,
          }
  } else {
    shiftStatePayload =
      nextStatus === 'approved'
        ? {
            state: 'open',
            reserved_by: null,
            active_request_id: null,
            updated_at: approvedAt,
          }
        : {
            state: 'tentative_assignment',
            active_request_id: null,
            updated_at: approvedAt,
          }
  }

  const updatedShiftState = await supabase
    .from('preliminary_shift_states')
    .update(shiftStatePayload as Record<string, unknown>)
    .eq('id', currentShiftState.id)

  if (updatedShiftState.error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        updatedShiftState.error.message ?? 'Could not update preliminary shift state after review.'
      ),
    }
  }

  return {
    data: {
      ...currentRequest,
      ...updatedRequestPayload,
    },
    error: null,
  }
}

export async function approvePreliminaryRequest(
  supabase: SupabaseLike,
  params: ReviewPreliminaryRequestParams
): Promise<MutationResult<PreliminaryRequestRow>> {
  return reviewPreliminaryRequest(supabase, params, 'approved')
}

export async function denyPreliminaryRequest(
  supabase: SupabaseLike,
  params: ReviewPreliminaryRequestParams
): Promise<MutationResult<PreliminaryRequestRow>> {
  return reviewPreliminaryRequest(supabase, params, 'denied')
}

export async function cancelPreliminaryRequest(
  supabase: SupabaseLike,
  params: CancelPreliminaryRequestParams
): Promise<MutationResult<PreliminaryRequestRow>> {
  const request = await getRequest(supabase, params.requestId)
  if (request.error) return { data: null, error: request.error }
  if (!request.data) {
    return {
      data: null,
      error: mutationError('request_not_found', 'Preliminary request not found.'),
    }
  }
  const currentRequest = request.data

  if (currentRequest.status !== 'pending') {
    return {
      data: null,
      error: mutationError('request_not_pending', 'Only pending requests can be cancelled.'),
    }
  }

  if (currentRequest.requester_id !== params.requesterId) {
    return {
      data: null,
      error: mutationError(
        'not_request_owner',
        'Only the requester can cancel this preliminary request.'
      ),
    }
  }

  const shiftState = await getShiftState(
    supabase,
    currentRequest.snapshot_id,
    currentRequest.shift_id
  )
  if (shiftState.error) return { data: null, error: shiftState.error }
  if (!shiftState.data) {
    return {
      data: null,
      error: mutationError('shift_state_not_found', 'Preliminary shift state not found.'),
    }
  }
  const currentShiftState = shiftState.data

  const updatedRequestPayload = {
    status: 'cancelled' as const,
    decision_note: null,
    approved_by: null,
    approved_at: null,
  }

  const updatedRequest = await supabase
    .from('preliminary_requests')
    .update(updatedRequestPayload)
    .eq('id', currentRequest.id)

  if (updatedRequest.error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        updatedRequest.error.message ?? 'Could not cancel preliminary request.'
      ),
    }
  }

  const shiftStatePayload: Partial<PreliminaryShiftStateRow> =
    currentRequest.type === 'claim_open_shift'
      ? {
          state: 'open',
          reserved_by: null,
          active_request_id: null,
          updated_at: nowIso(),
        }
      : {
          state: 'tentative_assignment',
          active_request_id: null,
          updated_at: nowIso(),
        }

  const updatedShiftState = await supabase
    .from('preliminary_shift_states')
    .update(shiftStatePayload as Record<string, unknown>)
    .eq('id', currentShiftState.id)

  if (updatedShiftState.error) {
    return {
      data: null,
      error: mutationError(
        'database_error',
        updatedShiftState.error.message ?? 'Could not update preliminary shift after cancellation.'
      ),
    }
  }

  return {
    data: {
      ...currentRequest,
      ...updatedRequestPayload,
    },
    error: null,
  }
}
