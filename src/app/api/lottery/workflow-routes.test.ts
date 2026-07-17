import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createClientMock,
  createAdminClientMock,
  isTrustedMutationRequestMock,
  loadLotteryActorMock,
  addLotteryRequestMock,
  removeLotteryRequestMock,
  addLotteryListEntryMock,
  moveLotteryListEntryMock,
  applyLotteryDecisionMock,
  loadLotteryHistoryMock,
  writeAuditLogMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  isTrustedMutationRequestMock: vi.fn(),
  loadLotteryActorMock: vi.fn(),
  addLotteryRequestMock: vi.fn(),
  removeLotteryRequestMock: vi.fn(),
  addLotteryListEntryMock: vi.fn(),
  moveLotteryListEntryMock: vi.fn(),
  applyLotteryDecisionMock: vi.fn(),
  loadLotteryHistoryMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/security/request-origin', () => ({
  isTrustedMutationRequest: isTrustedMutationRequestMock,
}))

vi.mock('@/lib/lottery/service', () => ({
  loadLotteryActor: loadLotteryActorMock,
  addLotteryRequest: addLotteryRequestMock,
  removeLotteryRequest: removeLotteryRequestMock,
  addLotteryListEntry: addLotteryListEntryMock,
  moveLotteryListEntry: moveLotteryListEntryMock,
  applyLotteryDecision: applyLotteryDecisionMock,
  loadLotteryHistory: loadLotteryHistoryMock,
}))

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: writeAuditLogMock,
}))

import { POST as applyLotteryPost } from '@/app/api/lottery/apply/route'
import { GET as lotteryHistoryGet } from '@/app/api/lottery/history/route'
import { POST as lotteryListPost } from '@/app/api/lottery/list/route'
import { POST as lotteryRequestPost } from '@/app/api/lottery/request/route'

function createSupabaseMock(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: userId ? { id: userId } : null,
        },
      })),
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
  }
}

function createAdminMock() {
  const shiftsQuery = {
    select: vi.fn(() => shiftsQuery),
    eq: vi.fn(() => shiftsQuery),
    in: vi.fn(async () => ({
      data: [{ id: 'shift-2' }],
      error: null,
    })),
  }

  return {
    rpc: vi.fn(async () => ({ data: null, error: null })),
    from: vi.fn((table: string) => {
      if (table !== 'shifts') throw new Error(`Unexpected admin table ${table}`)
      return shiftsQuery
    }),
  }
}

const actor = {
  userId: 'manager-1',
  fullName: 'Manager User',
  role: 'manager',
  siteId: 'default',
  shiftType: 'day',
} as const

describe('lottery workflow routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTrustedMutationRequestMock.mockReturnValue(true)
    loadLotteryActorMock.mockResolvedValue(actor)
    addLotteryRequestMock.mockResolvedValue({ ok: true })
    removeLotteryRequestMock.mockResolvedValue({ ok: true })
    addLotteryListEntryMock.mockResolvedValue({ ok: true })
    moveLotteryListEntryMock.mockResolvedValue({ ok: true })
    applyLotteryDecisionMock.mockResolvedValue({ ok: true })
    createAdminClientMock.mockReturnValue(createAdminMock())
    loadLotteryHistoryMock.mockResolvedValue([
      {
        id: 'history-1',
        shiftDate: '2026-04-23',
        shiftType: 'night',
        appliedStatus: 'on_call',
        createdAt: '2026-04-20T12:00:00.000Z',
        createdByName: 'Manager User',
        overrideApplied: false,
        invalidatedAt: null,
        invalidatedReason: null,
        requestRestored: false,
      },
    ])
  })

  it('rejects untrusted request mutations before touching lottery services', async () => {
    isTrustedMutationRequestMock.mockReturnValue(false)

    const response = await lotteryRequestPost(
      new Request('http://localhost/api/lottery/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
        body: JSON.stringify({ action: 'add', shiftDate: '2026-04-23' }),
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid request origin.',
    })
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('adds a lottery request for the current actor when no therapist id is supplied', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(actor.userId))

    const response = await lotteryRequestPost(
      new Request('http://localhost/api/lottery/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          action: 'add',
          shiftDate: '2026-04-23',
          shiftType: 'night',
          requestedAt: '2026-04-20T12:00:00.000Z',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(loadLotteryActorMock).toHaveBeenCalledWith(actor.userId)
    expect(addLotteryRequestMock).toHaveBeenCalledWith({
      actor,
      therapistId: actor.userId,
      shiftDate: '2026-04-23',
      shiftType: 'night',
      requestedAt: '2026-04-20T12:00:00.000Z',
    })
  })

  it('rejects unknown request actions before touching lottery request mutations', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(actor.userId))

    const response = await lotteryRequestPost(
      new Request('http://localhost/api/lottery/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          action: 'archive',
          shiftDate: '2026-04-23',
        }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Action must be add or remove.',
    })
    expect(addLotteryRequestMock).not.toHaveBeenCalled()
    expect(removeLotteryRequestMock).not.toHaveBeenCalled()
  })

  it('moves a lottery list row down for the selected shift', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(actor.userId))

    const response = await lotteryListPost(
      new Request('http://localhost/api/lottery/list', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          action: 'move_down',
          entryId: 'entry-2',
          shiftType: 'night',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(moveLotteryListEntryMock).toHaveBeenCalledWith({
      actor,
      entryId: 'entry-2',
      shiftType: 'night',
      direction: 'down',
    })
  })

  it('rejects unknown list actions before touching lottery list mutations', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(actor.userId))

    const response = await lotteryListPost(
      new Request('http://localhost/api/lottery/list', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          action: 'remove',
          entryId: 'entry-2',
          shiftType: 'night',
        }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Action must be add, move_up, or move_down.',
    })
    expect(addLotteryListEntryMock).not.toHaveBeenCalled()
    expect(moveLotteryListEntryMock).not.toHaveBeenCalled()
  })

  it('rejects apply requests without the required preview context', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(actor.userId))

    const response = await applyLotteryPost(
      new Request('http://localhost/api/lottery/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          shiftDate: '2026-04-23',
          keepToWork: 1,
        }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Shift date, keep-to-work, and preview context are required.',
    })
    expect(applyLotteryDecisionMock).not.toHaveBeenCalled()
  })

  it('applies the lottery decision with trimmed therapist ids and the bound rpc client', async () => {
    const supabase = createSupabaseMock(actor.userId)
    createClientMock.mockResolvedValue(supabase)

    const response = await applyLotteryPost(
      new Request('http://localhost/api/lottery/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          shiftDate: '2026-04-23',
          shiftType: 'night',
          keepToWork: 2,
          contextSignature: 'ctx-1',
          actions: [{ therapistId: ' therapist-2 ', status: 'on_call' }],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(applyLotteryDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        shiftDate: '2026-04-23',
        shiftType: 'night',
        keepToWork: 2,
        contextSignature: 'ctx-1',
        actions: [{ therapistId: 'therapist-2', status: 'on_call' }],
        authClient: {
          rpc: expect.any(Function),
        },
      })
    )
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: actor.userId,
        action: 'post_publish_modification',
        targetType: 'shift',
        targetId: 'shift-2',
      })
    )
  })

  it('requires a therapist id before loading lottery history', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(actor.userId))

    const response = await lotteryHistoryGet(
      new Request('http://localhost/api/lottery/history?shift=night')
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Therapist is required.',
    })
    expect(loadLotteryHistoryMock).not.toHaveBeenCalled()
  })

  it('rejects lottery history reads for another therapist when the actor is not a manager', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock('staff-1'))
    loadLotteryActorMock.mockResolvedValue({
      userId: 'staff-1',
      fullName: 'Staff User',
      role: 'therapist',
      siteId: 'default',
      shiftType: 'day',
    })

    const response = await lotteryHistoryGet(
      new Request('http://localhost/api/lottery/history?therapistId=therapist-2&shift=night')
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: 'You can only view your own Lottery history.',
    })
    expect(loadLotteryHistoryMock).not.toHaveBeenCalled()
  })

  it('allows leads to read lottery history for another therapist', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock('lead-1'))
    loadLotteryActorMock.mockResolvedValue({
      userId: 'lead-1',
      fullName: 'Lead User',
      role: 'lead',
      siteId: 'default',
      shiftType: 'day',
    })

    const response = await lotteryHistoryGet(
      new Request('http://localhost/api/lottery/history?therapistId=therapist-2&shift=night')
    )

    expect(response.status).toBe(200)
    expect(loadLotteryHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        therapistId: 'therapist-2',
        shiftType: 'night',
      })
    )
  })

  it('loads history for the selected therapist and shift', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(actor.userId))

    const response = await lotteryHistoryGet(
      new Request('http://localhost/api/lottery/history?therapistId=therapist-2&shift=night')
    )

    expect(response.status).toBe(200)
    expect(loadLotteryHistoryMock).toHaveBeenCalledWith({
      actor,
      therapistId: 'therapist-2',
      shiftType: 'night',
    })
    await expect(response.json()).resolves.toMatchObject({
      history: [
        expect.objectContaining({
          id: 'history-1',
          appliedStatus: 'on_call',
        }),
      ],
    })
  })
})
