import { describe, expect, it } from 'vitest'

import {
  approvePreliminaryRequest,
  cancelPreliminaryRequest,
  applyDirectPreliminaryEdit,
  denyPreliminaryRequest,
  refreshPreliminarySnapshot,
  sendPreliminarySnapshot,
  submitPreliminaryChangeRequest,
  submitPreliminaryClaimRequest,
} from '@/lib/preliminary-schedule/mutations'
import type {
  PreliminaryRequestRow,
  PreliminaryShiftRow,
  PreliminaryShiftStateRow,
  PreliminarySnapshotRow,
} from '@/lib/preliminary-schedule/types'

type DbState = {
  preliminarySnapshots: PreliminarySnapshotRow[]
  preliminaryShiftStates: PreliminaryShiftStateRow[]
  preliminaryRequests: PreliminaryRequestRow[]
  shifts: PreliminaryShiftRow[]
  profiles: Array<{
    id: string
    role: string | null
    shift_type: 'day' | 'night' | null
    is_lead_eligible?: boolean | null
  }>
}

function makeSnapshot(overrides: Partial<PreliminarySnapshotRow> = {}): PreliminarySnapshotRow {
  return {
    id: 'snapshot-1',
    cycle_id: 'cycle-1',
    created_by: 'manager-1',
    sent_at: '2026-03-19T10:00:00.000Z',
    status: 'active',
    created_at: '2026-03-19T10:00:00.000Z',
    ...overrides,
  }
}

function makeShift(overrides: Partial<PreliminaryShiftRow> = {}): PreliminaryShiftRow {
  return {
    id: 'shift-1',
    cycle_id: 'cycle-1',
    user_id: 'therapist-1',
    date: '2026-03-22',
    shift_type: 'day',
    status: 'scheduled',
    role: 'staff',
    full_name: 'Barbara C.',
    ...overrides,
  }
}

function makeShiftState(
  overrides: Partial<PreliminaryShiftStateRow> = {}
): PreliminaryShiftStateRow {
  return {
    id: 'state-1',
    snapshot_id: 'snapshot-1',
    shift_id: 'shift-1',
    state: 'tentative_assignment',
    reserved_by: null,
    active_request_id: null,
    updated_at: '2026-03-19T10:00:00.000Z',
    ...overrides,
  }
}

function makeRequest(overrides: Partial<PreliminaryRequestRow> = {}): PreliminaryRequestRow {
  return {
    id: 'request-1',
    snapshot_id: 'snapshot-1',
    shift_id: 'shift-1',
    requester_id: 'therapist-1',
    type: 'request_change',
    status: 'pending',
    note: null,
    decision_note: null,
    approved_by: null,
    approved_at: null,
    created_at: '2026-03-19T10:00:00.000Z',
    requester_name: 'Barbara C.',
    ...overrides,
  }
}

function createSupabaseMock(initialState: Partial<DbState> = {}) {
  const state: DbState = {
    preliminarySnapshots: initialState.preliminarySnapshots ?? [],
    preliminaryShiftStates: initialState.preliminaryShiftStates ?? [],
    preliminaryRequests: initialState.preliminaryRequests ?? [],
    shifts: initialState.shifts ?? [],
    profiles: initialState.profiles ?? [],
  }

  function applyFilters<T extends Record<string, unknown>>(
    rows: T[],
    filters: Array<{ column: string; value: unknown }>
  ): T[] {
    return rows.filter((row) => filters.every((filter) => row[filter.column] === filter.value))
  }

  function from(table: string) {
    const filters: Array<{ column: string; value: unknown }> = []

    const builder = {
      select() {
        return builder
      },
      eq(column: string, value: unknown) {
        filters.push({ column, value })
        return builder
      },
      async maybeSingle() {
        if (table === 'preliminary_snapshots') {
          const row = applyFilters(state.preliminarySnapshots, filters)[0] ?? null
          return { data: row, error: null }
        }

        if (table === 'preliminary_shift_states') {
          const row = applyFilters(state.preliminaryShiftStates, filters)[0] ?? null
          return { data: row, error: null }
        }

        if (table === 'preliminary_requests') {
          const row = applyFilters(state.preliminaryRequests, filters)[0] ?? null
          return { data: row, error: null }
        }

        if (table === 'shifts') {
          const row = applyFilters(state.shifts, filters)[0] ?? null
          return { data: row, error: null }
        }

        if (table === 'profiles') {
          const row = applyFilters(state.profiles, filters)[0] ?? null
          return { data: row, error: null }
        }

        return { data: null, error: null }
      },
      insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
        const rows = Array.isArray(payload) ? payload : [payload]
        return {
          select() {
            return {
              async single() {
                const inserted = rows[0] as Record<string, unknown>
                if (table === 'preliminary_snapshots') {
                  state.preliminarySnapshots.push(inserted as PreliminarySnapshotRow)
                } else if (table === 'preliminary_requests') {
                  state.preliminaryRequests.push(inserted as PreliminaryRequestRow)
                } else if (table === 'shifts') {
                  state.shifts.push(inserted as PreliminaryShiftRow)
                }
                return { data: inserted, error: null }
              },
            }
          },
        }
      },
      upsert(payload: Array<Record<string, unknown>>) {
        if (table === 'preliminary_shift_states') {
          for (const row of payload as PreliminaryShiftStateRow[]) {
            const existingIndex = state.preliminaryShiftStates.findIndex(
              (item) => item.snapshot_id === row.snapshot_id && item.shift_id === row.shift_id
            )
            if (existingIndex >= 0) state.preliminaryShiftStates[existingIndex] = row
            else state.preliminaryShiftStates.push(row)
          }
        }

        return Promise.resolve({ data: payload, error: null })
      },
      update(payload: Record<string, unknown>) {
        return {
          eq(column: string, value: unknown) {
            if (table === 'preliminary_snapshots') {
              state.preliminarySnapshots = state.preliminarySnapshots.map((row) =>
                row[column as keyof PreliminarySnapshotRow] === value
                  ? ({ ...row, ...payload } as PreliminarySnapshotRow)
                  : row
              )
              const data =
                state.preliminarySnapshots.find(
                  (row) => row[column as keyof PreliminarySnapshotRow] === value
                ) ?? null
              return Promise.resolve({ data, error: null })
            }

            if (table === 'preliminary_shift_states') {
              state.preliminaryShiftStates = state.preliminaryShiftStates.map((row) =>
                row[column as keyof PreliminaryShiftStateRow] === value
                  ? ({ ...row, ...payload } as PreliminaryShiftStateRow)
                  : row
              )
              const data =
                state.preliminaryShiftStates.find(
                  (row) => row[column as keyof PreliminaryShiftStateRow] === value
                ) ?? null
              return Promise.resolve({ data, error: null })
            }

            if (table === 'preliminary_requests') {
              state.preliminaryRequests = state.preliminaryRequests.map((row) =>
                row[column as keyof PreliminaryRequestRow] === value
                  ? ({ ...row, ...payload } as PreliminaryRequestRow)
                  : row
              )
              const data =
                state.preliminaryRequests.find(
                  (row) => row[column as keyof PreliminaryRequestRow] === value
                ) ?? null
              return Promise.resolve({ data, error: null })
            }

            if (table === 'shifts') {
              state.shifts = state.shifts.map((row) =>
                row[column as keyof PreliminaryShiftRow] === value
                  ? ({ ...row, ...payload } as PreliminaryShiftRow)
                  : row
              )
              const data =
                state.shifts.find((row) => row[column as keyof PreliminaryShiftRow] === value) ??
                null
              return Promise.resolve({ data, error: null })
            }

            return Promise.resolve({ data: null, error: null })
          },
        }
      },
      delete() {
        return {
          eq(column: string, value: unknown) {
            if (table === 'preliminary_shift_states') {
              state.preliminaryShiftStates = state.preliminaryShiftStates.filter(
                (row) => row[column as keyof PreliminaryShiftStateRow] !== value
              )
            }
            if (table === 'shifts') {
              state.shifts = state.shifts.filter(
                (row) => row[column as keyof PreliminaryShiftRow] !== value
              )
            }
            return Promise.resolve({ error: null })
          },
        }
      },
    }

    return builder
  }

  return { state, from }
}

describe('sendPreliminarySnapshot', () => {
  it('creates an active snapshot and seeded shift states', async () => {
    const supabase = createSupabaseMock({
      shifts: [makeShift({ id: 'shift-open', user_id: null, full_name: null })],
    })

    const result = await sendPreliminarySnapshot(supabase as never, {
      cycleId: 'cycle-1',
      actorId: 'manager-1',
      shifts: [makeShift({ id: 'shift-open', user_id: null, full_name: null })],
    })

    expect(result.error).toBeNull()
    expect(result.data?.status).toBe('active')
    expect(supabase.state.preliminaryShiftStates).toHaveLength(1)
    expect(supabase.state.preliminaryShiftStates[0]?.state).toBe('open')
  })

  it('reuses the existing active snapshot when sending again for the same cycle', async () => {
    const supabase = createSupabaseMock({
      preliminarySnapshots: [makeSnapshot({ id: 'snapshot-existing', cycle_id: 'cycle-1' })],
    })

    const result = await sendPreliminarySnapshot(supabase as never, {
      cycleId: 'cycle-1',
      actorId: 'manager-1',
      shifts: [makeShift()],
    })

    expect(result.error).toBeNull()
    expect(result.data?.id).toBe('snapshot-existing')
    expect(supabase.state.preliminarySnapshots).toHaveLength(1)
  })
})

describe('refreshPreliminarySnapshot', () => {
  it('replaces prior shift state rows in place for the same snapshot', async () => {
    const supabase = createSupabaseMock({
      preliminaryShiftStates: [
        makeShiftState({ snapshot_id: 'snapshot-1', shift_id: 'stale-shift' }),
      ],
    })

    const result = await refreshPreliminarySnapshot(supabase as never, {
      snapshotId: 'snapshot-1',
      shifts: [makeShift({ id: 'fresh-shift', user_id: null, full_name: null })],
    })

    expect(result.error).toBeNull()
    expect(supabase.state.preliminaryShiftStates).toHaveLength(1)
    expect(supabase.state.preliminaryShiftStates[0]?.shift_id).toBe('fresh-shift')
  })
})

describe('submitPreliminaryClaimRequest', () => {
  it('creates a pending request and reserves the open slot', async () => {
    const supabase = createSupabaseMock({
      preliminaryShiftStates: [
        makeShiftState({
          id: 'state-open',
          shift_id: 'shift-open',
          state: 'open',
        }),
      ],
      shifts: [makeShift({ id: 'shift-open', user_id: null, full_name: null })],
    })

    const result = await submitPreliminaryClaimRequest(supabase as never, {
      snapshotId: 'snapshot-1',
      shiftId: 'shift-open',
      requesterId: 'therapist-2',
      note: 'Can fill this one',
    })

    expect(result.error).toBeNull()
    expect(result.data?.type).toBe('claim_open_shift')
    expect(supabase.state.preliminaryShiftStates[0]).toMatchObject({
      state: 'pending_claim',
      reserved_by: 'therapist-2',
    })
  })

  it('rejects a second claim when the slot is already reserved', async () => {
    const supabase = createSupabaseMock({
      preliminaryShiftStates: [
        makeShiftState({
          shift_id: 'shift-open',
          state: 'pending_claim',
          reserved_by: 'therapist-2',
        }),
      ],
    })

    const result = await submitPreliminaryClaimRequest(supabase as never, {
      snapshotId: 'snapshot-1',
      shiftId: 'shift-open',
      requesterId: 'therapist-3',
    })

    expect(result.error?.code).toBe('slot_already_reserved')
  })
})

describe('submitPreliminaryChangeRequest', () => {
  it('rejects request change when the therapist does not own the assignment', async () => {
    const supabase = createSupabaseMock({
      preliminaryShiftStates: [
        makeShiftState({ shift_id: 'shift-1', state: 'tentative_assignment' }),
      ],
      shifts: [makeShift({ id: 'shift-1', user_id: 'therapist-1' })],
    })

    const result = await submitPreliminaryChangeRequest(supabase as never, {
      snapshotId: 'snapshot-1',
      shiftId: 'shift-1',
      requesterId: 'therapist-2',
    })

    expect(result.error?.code).toBe('not_shift_owner')
  })
})

describe('applyDirectPreliminaryEdit', () => {
  it('lets a therapist remove themselves from their own tentative assignment immediately', async () => {
    const supabase = createSupabaseMock({
      preliminaryShiftStates: [
        makeShiftState({ shift_id: 'shift-1', state: 'tentative_assignment' }),
      ],
      shifts: [makeShift({ id: 'shift-1', user_id: 'therapist-1' })],
      profiles: [{ id: 'therapist-1', role: 'therapist', shift_type: 'day' }],
    })

    const result = await applyDirectPreliminaryEdit(supabase as never, {
      snapshotId: 'snapshot-1',
      shiftId: 'shift-1',
      requesterId: 'therapist-1',
      action: 'remove_me',
    })

    expect(result.error).toBeNull()
    expect(supabase.state.shifts[0]).toMatchObject({ user_id: null })
    expect(supabase.state.preliminaryShiftStates[0]).toMatchObject({
      state: 'open',
      reserved_by: null,
      active_request_id: null,
    })
  })

  it('lets a therapist add themselves to an open same-shift slot immediately', async () => {
    const supabase = createSupabaseMock({
      preliminaryShiftStates: [makeShiftState({ shift_id: 'shift-open', state: 'open' })],
      shifts: [makeShift({ id: 'shift-open', user_id: null, full_name: null })],
      profiles: [{ id: 'therapist-2', role: 'therapist', shift_type: 'day' }],
    })

    const result = await applyDirectPreliminaryEdit(supabase as never, {
      snapshotId: 'snapshot-1',
      shiftId: 'shift-open',
      requesterId: 'therapist-2',
      action: 'add_here',
    })

    expect(result.error).toBeNull()
    expect(supabase.state.shifts[0]).toMatchObject({ user_id: 'therapist-2' })
    expect(supabase.state.preliminaryShiftStates[0]).toMatchObject({
      state: 'tentative_assignment',
      reserved_by: 'therapist-2',
      active_request_id: null,
    })
  })
})

describe('request review helpers', () => {
  it('approves a pending claim and keeps the slot filled in preliminary state', async () => {
    const supabase = createSupabaseMock({
      preliminaryRequests: [
        makeRequest({
          id: 'request-claim',
          shift_id: 'shift-open',
          requester_id: 'therapist-2',
          type: 'claim_open_shift',
        }),
      ],
      preliminaryShiftStates: [
        makeShiftState({
          shift_id: 'shift-open',
          state: 'pending_claim',
          reserved_by: 'therapist-2',
          active_request_id: 'request-claim',
        }),
      ],
      shifts: [makeShift({ id: 'shift-open', user_id: null, full_name: null })],
    })

    const result = await approvePreliminaryRequest(supabase as never, {
      requestId: 'request-claim',
      actorId: 'manager-1',
    })

    expect(result.error).toBeNull()
    expect(supabase.state.preliminaryRequests[0]).toMatchObject({
      status: 'approved',
      approved_by: 'manager-1',
    })
    expect(supabase.state.preliminaryShiftStates[0]).toMatchObject({
      state: 'tentative_assignment',
      reserved_by: 'therapist-2',
      active_request_id: null,
    })
    expect(supabase.state.shifts[0]).toMatchObject({
      id: 'shift-open',
      user_id: 'therapist-2',
    })
  })

  it('denies a pending claim and releases the slot back to open', async () => {
    const supabase = createSupabaseMock({
      preliminaryRequests: [
        makeRequest({
          id: 'request-claim',
          shift_id: 'shift-open',
          requester_id: 'therapist-2',
          type: 'claim_open_shift',
        }),
      ],
      preliminaryShiftStates: [
        makeShiftState({
          shift_id: 'shift-open',
          state: 'pending_claim',
          reserved_by: 'therapist-2',
          active_request_id: 'request-claim',
        }),
      ],
      shifts: [makeShift({ id: 'shift-open', user_id: 'therapist-2', full_name: 'Alex P.' })],
    })

    const result = await denyPreliminaryRequest(supabase as never, {
      requestId: 'request-claim',
      actorId: 'manager-1',
    })

    expect(result.error).toBeNull()
    expect(supabase.state.preliminaryRequests[0]).toMatchObject({
      status: 'denied',
      approved_by: 'manager-1',
    })
    expect(supabase.state.preliminaryShiftStates[0]).toMatchObject({
      state: 'open',
      reserved_by: null,
      active_request_id: null,
    })
    expect(supabase.state.shifts[0]).toMatchObject({
      id: 'shift-open',
      user_id: null,
    })
  })

  it('cancels a pending change request and restores the tentative assignment state', async () => {
    const supabase = createSupabaseMock({
      preliminaryRequests: [
        makeRequest({
          id: 'request-change',
          shift_id: 'shift-1',
          requester_id: 'therapist-1',
          type: 'request_change',
        }),
      ],
      preliminaryShiftStates: [
        makeShiftState({
          shift_id: 'shift-1',
          state: 'pending_change',
          active_request_id: 'request-change',
        }),
      ],
    })

    const result = await cancelPreliminaryRequest(supabase as never, {
      requestId: 'request-change',
      requesterId: 'therapist-1',
    })

    expect(result.error).toBeNull()
    expect(supabase.state.preliminaryRequests[0]).toMatchObject({
      status: 'cancelled',
    })
    expect(supabase.state.preliminaryShiftStates[0]).toMatchObject({
      state: 'tentative_assignment',
      active_request_id: null,
    })
  })

  it('approves a pending change request and removes the therapist from the tentative shift', async () => {
    const supabase = createSupabaseMock({
      preliminaryRequests: [
        makeRequest({
          id: 'request-change',
          shift_id: 'shift-1',
          requester_id: 'therapist-1',
          type: 'request_change',
        }),
      ],
      preliminaryShiftStates: [
        makeShiftState({
          shift_id: 'shift-1',
          state: 'pending_change',
          active_request_id: 'request-change',
        }),
      ],
      shifts: [makeShift({ id: 'shift-1', user_id: 'therapist-1' })],
    })

    const result = await approvePreliminaryRequest(supabase as never, {
      requestId: 'request-change',
      actorId: 'manager-1',
    })

    expect(result.error).toBeNull()
    expect(supabase.state.preliminaryRequests[0]).toMatchObject({
      status: 'approved',
      approved_by: 'manager-1',
    })
    expect(supabase.state.preliminaryShiftStates[0]).toMatchObject({
      state: 'open',
      reserved_by: null,
      active_request_id: null,
    })
    expect(supabase.state.shifts[0]).toMatchObject({
      id: 'shift-1',
      user_id: null,
    })
  })
})
