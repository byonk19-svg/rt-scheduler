import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, createClientMock, loadLotteryActorMock, loadLotterySnapshotMock } =
  vi.hoisted(() => ({
    redirectMock: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`)
    }),
    createClientMock: vi.fn(),
    loadLotteryActorMock: vi.fn(),
    loadLotterySnapshotMock: vi.fn(),
  }))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/lottery/service', () => ({
  loadLotteryActor: loadLotteryActorMock,
  loadLotterySnapshot: loadLotterySnapshotMock,
}))

vi.mock('@/components/lottery/LotteryClientPage', () => ({
  default: ({ initialSnapshot }: { initialSnapshot: { selectedDate: string | null } }) =>
    createElement('div', null, `Lottery snapshot for ${initialSnapshot.selectedDate ?? 'none'}`),
}))

import LotteryPage from '@/app/(app)/lottery/page'

function createSupabaseMock(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: userId ? { id: userId } : null,
        },
      })),
    },
  }
}

describe('LotteryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadLotteryActorMock.mockResolvedValue({
      userId: 'manager-1',
      fullName: 'Manager User',
      role: 'manager',
      siteId: 'site-1',
      shiftType: 'day',
    })
    loadLotterySnapshotMock.mockResolvedValue({
      selectedDate: '2026-04-23',
      selectedShift: 'day',
    })
  })

  it('renders the lottery workspace for an authorized manager', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock('manager-1'))

    const html = renderToStaticMarkup(
      await LotteryPage({
        searchParams: Promise.resolve({
          date: '2026-04-23',
          shift: 'night',
        }),
      })
    )

    expect(loadLotteryActorMock).toHaveBeenCalledWith('manager-1')
    expect(loadLotterySnapshotMock).toHaveBeenCalledWith({
      actor: expect.objectContaining({ userId: 'manager-1' }),
      shiftDate: '2026-04-23',
      shiftType: 'night',
    })
    expect(html).toContain('Lottery snapshot for 2026-04-23')
  })

  it('redirects unauthenticated users to login', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(null))

    await expect(LotteryPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/login'
    )
  })

  it('redirects users without lottery access back to staff dashboard', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock('therapist-1'))
    loadLotteryActorMock.mockResolvedValue(null)

    await expect(LotteryPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/dashboard/staff'
    )
  })
})
