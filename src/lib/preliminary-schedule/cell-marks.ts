export type PreliminaryCellMarkType = 'mark_off' | 'add_work'
export type PreliminaryCellMarkDecision = 'approved' | 'denied' | 'dismissed'

export type PreliminaryCellMarkMutationError = {
  message: string
}

export type PreliminaryCellMarkMutationResult<T> = {
  data: T | null
  error: PreliminaryCellMarkMutationError | null
}

type RpcResult<T> = PromiseLike<{ data: T | null; error: { message?: string } | null }>

type PreliminaryCellMarkRpcClient = {
  rpc: {
    (
      fn: 'app_create_preliminary_mark_group',
      args: { p_actor_id: string; p_snapshot_id: string; p_note?: string | null }
    ): RpcResult<Array<{ id: string }> | { id: string }>
    (
      fn: 'app_create_preliminary_cell_mark',
      args: {
        p_actor_id: string
        p_snapshot_id: string
        p_mark_type: PreliminaryCellMarkType
        p_mark_date: string
        p_shift_type: 'day' | 'night'
        p_shift_id?: string | null
        p_group_id?: string | null
        p_note?: string | null
      }
    ): RpcResult<
      Array<{ id: string; group_id: string | null }> | { id: string; group_id: string | null }
    >
    (
      fn: 'app_cancel_preliminary_cell_mark',
      args: { p_actor_id: string; p_mark_id: string }
    ): RpcResult<Array<{ id: string }> | { id: string }>
    (
      fn: 'app_review_preliminary_cell_mark',
      args: {
        p_actor_id: string
        p_mark_id: string
        p_decision: PreliminaryCellMarkDecision
        p_decision_note?: string | null
      }
    ): RpcResult<
      | Array<{ id: string; status: PreliminaryCellMarkDecision }>
      | { id: string; status: PreliminaryCellMarkDecision }
    >
  }
}

function firstRow<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function mutationError(
  error: { message?: string } | null
): PreliminaryCellMarkMutationError | null {
  if (!error) return null
  return { message: error.message ?? 'Preliminary mark mutation failed.' }
}

export async function createPreliminaryMarkGroup(
  client: PreliminaryCellMarkRpcClient,
  params: {
    actorId: string
    snapshotId: string
    note?: string | null
  }
): Promise<PreliminaryCellMarkMutationResult<{ id: string }>> {
  const result = await client.rpc('app_create_preliminary_mark_group', {
    p_actor_id: params.actorId,
    p_snapshot_id: params.snapshotId,
    p_note: params.note ?? null,
  })

  if (result.error) return { data: null, error: mutationError(result.error) }
  const row = firstRow(result.data)
  return row ? { data: row, error: null } : { data: null, error: { message: 'No group returned.' } }
}

export async function createPreliminaryCellMark(
  client: PreliminaryCellMarkRpcClient,
  params: {
    actorId: string
    snapshotId: string
    markType: PreliminaryCellMarkType
    date: string
    shiftType: 'day' | 'night'
    shiftId?: string | null
    groupId?: string | null
    note?: string | null
  }
): Promise<PreliminaryCellMarkMutationResult<{ id: string; groupId: string | null }>> {
  const result = await client.rpc('app_create_preliminary_cell_mark', {
    p_actor_id: params.actorId,
    p_snapshot_id: params.snapshotId,
    p_mark_type: params.markType,
    p_mark_date: params.date,
    p_shift_type: params.shiftType,
    p_shift_id: params.shiftId ?? null,
    p_group_id: params.groupId ?? null,
    p_note: params.note ?? null,
  })

  if (result.error) return { data: null, error: mutationError(result.error) }
  const row = firstRow(result.data)
  return row
    ? { data: { id: row.id, groupId: row.group_id }, error: null }
    : { data: null, error: { message: 'No mark returned.' } }
}

export async function cancelPreliminaryCellMark(
  client: PreliminaryCellMarkRpcClient,
  params: {
    actorId: string
    markId: string
  }
): Promise<PreliminaryCellMarkMutationResult<{ id: string }>> {
  const result = await client.rpc('app_cancel_preliminary_cell_mark', {
    p_actor_id: params.actorId,
    p_mark_id: params.markId,
  })

  if (result.error) return { data: null, error: mutationError(result.error) }
  const row = firstRow(result.data)
  return row ? { data: row, error: null } : { data: null, error: { message: 'No mark returned.' } }
}

export async function reviewPreliminaryCellMark(
  client: PreliminaryCellMarkRpcClient,
  params: {
    actorId: string
    markId: string
    decision: PreliminaryCellMarkDecision
    decisionNote?: string | null
  }
): Promise<PreliminaryCellMarkMutationResult<{ id: string; status: PreliminaryCellMarkDecision }>> {
  const result = await client.rpc('app_review_preliminary_cell_mark', {
    p_actor_id: params.actorId,
    p_mark_id: params.markId,
    p_decision: params.decision,
    p_decision_note: params.decisionNote ?? null,
  })

  if (result.error) return { data: null, error: mutationError(result.error) }
  const row = firstRow(result.data)
  return row
    ? { data: row, error: null }
    : { data: null, error: { message: 'No review returned.' } }
}
