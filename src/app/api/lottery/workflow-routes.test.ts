import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createClientMock,
  isTrustedMutationRequestMock,
  loadLotteryActorMock,
  addLotteryRequestMock,
  removeLotteryRequestMock,
  addLotteryListEntryMock,
  moveLotteryListEntryMock,
  applyLotteryDecisionMock,
  loadLotteryHistoryMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  isTrustedMutationRequestMock: vi.fn(),
  loadLotteryActorMock: vi.fn(),
  addLotteryRequestMock: vi.fn(),
  removeLotteryRequestMock: vi.fn(),
  addLotteryListEntryMock: vi.fn(),
  moveLotteryListEntryMock: vi.fn(),
  applyLotteryDecisionMock: vi.fn(),
  loadLotteryHistoryMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
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

  it('removes a lottery request for the supplied therapist and defaults the shift to day', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(actor.userId))

    const response = await lotteryRequestPost(
      new Request('http://localhost/api/lottery/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          action: 'remove',
          therapistId: ' therapist-9 ',
          shiftDate: '2026-04-23',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(removeLotteryRequestMock).toHaveBeenCalledWith({
      actor,
      therapistId: 'therapist-9',
      shiftDate: '2026-04-23',
      shiftType: 'day',
    })
  })

  it('adds a therapist to the lottery list for the selected shift', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(actor.userId))

    const response = await lotteryListPost(
      new Request('http://localhost/api/lottery/list', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          action: 'add',
          therapistId: ' therapist-3 ',
          shiftType: 'night',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(addLotteryListEntryMock).toHaveBeenCalledWith({
      actor,
      therapistId: 'therapist-3',
      shiftType: 'night',
    })
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
