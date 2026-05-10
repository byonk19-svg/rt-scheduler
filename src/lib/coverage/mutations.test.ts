import { describe, expect, it, vi } from 'vitest'

import { createCoverageShiftMutator } from '@/lib/coverage/mutations'

describe('CoverageShiftMutator.assign', () => {
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

    const result = await createCoverageShiftMutator().assign({
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

describe('CoverageShiftMutator.setDesignatedLead', () => {
  it('posts set_lead to drag-drop with therapist id and date', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: 'ok' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createCoverageShiftMutator().setDesignatedLead({
      cycleId: 'cycle-1',
      therapistId: 'therapist-9',
      isoDate: '2026-05-16',
      shiftType: 'day',
    })

    expect(result.error).toBe(null)
    expect(fetchMock).toHaveBeenCalledWith('/api/schedule/drag-drop', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'set_lead',
        cycleId: 'cycle-1',
        therapistId: 'therapist-9',
        date: '2026-05-16',
        shiftType: 'day',
        overrideWeeklyRules: false,
      }),
    })
  })

  it('surfaces API errors with the same normalized shape as other coverage mutations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ code: 'lead_gap', error: 'Lead coverage gap' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      )
    )

    const result = await createCoverageShiftMutator().setDesignatedLead({
      cycleId: 'cycle-1',
      therapistId: 'therapist-9',
      isoDate: '2026-05-16',
      shiftType: 'day',
    })

    expect(result.error).toEqual({ code: 'lead_gap', message: 'Lead coverage gap' })
  })
})

describe('CoverageShiftMutator.unassign', () => {
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

    const result = await createCoverageShiftMutator().unassign({
      cycleId: 'cycle-1',
      shiftId: 'shift-1',
    })

    expect(result.error).toEqual({ message: 'Could not remove shift' })
  })
  it('calls drag-drop API without client-controlled audit flags', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await createCoverageShiftMutator().unassign({
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

describe('CoverageShiftMutator.updateStatus', () => {
  it('returns no error on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ assignment: { id: 'shift-1' } }), { status: 200 }))
    )

    const result = await createCoverageShiftMutator().updateStatus('shift-1', {
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

    const result = await createCoverageShiftMutator().updateStatus('shift-1', {
      assignment_status: 'cancelled',
      status: 'scheduled',
    })
    expect(result.error).toEqual({ code: undefined, message: 'Could not update assignment status.' })
  })

  it('calls assignment-status API with correct assignment_status', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ assignment: { id: 'shift-99' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await createCoverageShiftMutator().updateStatus('shift-99', {
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

describe('createCoverageShiftMutator', () => {
  it('presents one callable surface for coverage shift mutations', () => {
    const mutator = createCoverageShiftMutator()

    expect(Object.keys(mutator).sort()).toEqual([
      'assign',
      'setDesignatedLead',
      'unassign',
      'updateStatus',
    ])
  })
})
