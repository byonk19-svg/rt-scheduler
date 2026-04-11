import { describe, expect, it, vi } from 'vitest'

import {
  assignCoverageShift,
  assignCoverageShiftViaApi,
  persistCoverageShiftStatus,
  unassignCoverageShift,
  unassignCoverageShiftViaApi,
} from '@/lib/coverage/mutations'
import type { CoverageMutationError } from '@/lib/coverage/mutations'

function makeSupabase({
  insertResult = { data: null, error: null } as { data: unknown; error: CoverageMutationError },
  deleteResult = { error: null } as { error: CoverageMutationError },
  updateResult = { error: null } as { error: CoverageMutationError },
} = {}) {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(insertResult),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue(deleteResult),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue(updateResult),
      }),
    }),
  }
}

describe('assignCoverageShift', () => {
  it('returns data row on success', async () => {
    const row = {
      id: 'shift-1',
      user_id: 'user-1',
      date: '2026-03-01',
      shift_type: 'day',
      status: 'scheduled',
      assignment_status: null,
    }
    const supabase = makeSupabase({ insertResult: { data: row, error: null } })

    const result = await assignCoverageShift(supabase, {
      cycleId: 'cycle-1',
      userId: 'user-1',
      isoDate: '2026-03-01',
      shiftType: 'day',
    })

    expect(result.error).toBe(null)
    expect(result.data).toMatchObject({ id: 'shift-1', user_id: 'user-1' })
  })

  it('returns null data and the error on failure', async () => {
    const dbError: CoverageMutationError = { code: '23505', message: 'duplicate key' }
    const supabase = makeSupabase({ insertResult: { data: null, error: dbError } })

    const result = await assignCoverageShift(supabase, {
      cycleId: 'cycle-1',
      userId: 'user-1',
      isoDate: '2026-03-01',
      shiftType: 'day',
    })

    expect(result.data).toBe(null)
    expect(result.error).toEqual(dbError)
  })

  it('calls insert with correct fields', async () => {
    const supabase = makeSupabase()
    const fromMock = supabase.from('shifts')

    await assignCoverageShift(supabase, {
      cycleId: 'cycle-abc',
      userId: 'user-xyz',
      isoDate: '2026-04-15',
      shiftType: 'night',
    })

    expect(fromMock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        cycle_id: 'cycle-abc',
        user_id: 'user-xyz',
        date: '2026-04-15',
        shift_type: 'night',
        role: 'staff',
        status: 'scheduled',
      })
    )
  })
})

describe('assignCoverageShiftViaApi', () => {
  it('returns inserted shift data from the drag-drop API', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          shift: {
            id: 'shift-api-1',
            user_id: 'user-1',
            date: '2026-03-01',
            shift_type: 'day',
            status: 'scheduled',
            assignment_status: null,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await assignCoverageShiftViaApi({
      cycleId: 'cycle-1',
      userId: 'user-1',
      isoDate: '2026-03-01',
      shiftType: 'day',
      role: 'lead',
    })

    expect(result.error).toBe(null)
    expect(result.data).toMatchObject({ id: 'shift-api-1', user_id: 'user-1' })
    expect(fetchMock).toHaveBeenCalledWith('/api/schedule/drag-drop', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'user-1',
        date: '2026-03-01',
        shiftType: 'day',
        role: 'lead',
        overrideWeeklyRules: false,
      }),
    })
  })
})

describe('unassignCoverageShift', () => {
  it('returns no error on success', async () => {
    const supabase = makeSupabase({ deleteResult: { error: null } })
    const result = await unassignCoverageShift(supabase, 'shift-1')
    expect(result.error).toBe(null)
  })

  it('returns the error on failure', async () => {
    const dbError: CoverageMutationError = { message: 'row not found' }
    const supabase = makeSupabase({ deleteResult: { error: dbError } })
    const result = await unassignCoverageShift(supabase, 'shift-1')
    expect(result.error).toEqual(dbError)
  })
})

describe('unassignCoverageShiftViaApi', () => {
  it('surfaces the API error when delete fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ error: 'Could not remove shift' }),
          {
            status: 500,
            headers: { 'content-type': 'application/json' },
          }
        )
      )
    )

    const result = await unassignCoverageShiftViaApi({
      cycleId: 'cycle-1',
      shiftId: 'shift-1',
    })

    expect(result.error).toEqual({ message: 'Could not remove shift' })
  })
  it('calls drag-drop API without client-controlled audit flags', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await unassignCoverageShiftViaApi({
      cycleId: 'cycle-1',
      shiftId: 'shift-1',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/schedule/drag-drop', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'remove',
        cycleId: 'cycle-1',
        shiftId: 'shift-1',
      }),
    })
  })
})

describe('persistCoverageShiftStatus', () => {
  it('returns no error on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ assignment: { id: 'shift-1' } }), { status: 200 }))
    )

    const supabase = makeSupabase()
    const result = await persistCoverageShiftStatus(supabase, 'shift-1', {
      assignment_status: 'on_call',
      status: 'on_call',
    })
    expect(result.error).toBe(null)
  })

  it('returns the error on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'Could not update assignment status.' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      )
    )

    const supabase = makeSupabase()
    const result = await persistCoverageShiftStatus(supabase, 'shift-1', {
      assignment_status: 'cancelled',
      status: 'scheduled',
    })
    expect(result.error).toEqual({ code: undefined, message: 'Could not update assignment status.' })
  })

  it('calls assignment-status API with correct assignment_status', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ assignment: { id: 'shift-99' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const supabase = makeSupabase()

    await persistCoverageShiftStatus(supabase, 'shift-99', {
      assignment_status: 'left_early',
      status: 'scheduled',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/schedule/assignment-status', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        assignmentId: 'shift-99',
        status: 'left_early',
      }),
    })
  })
})
