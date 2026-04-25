import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, createClientMock, loadShiftBoardSnapshotMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  createClientMock: vi.fn(),
  loadShiftBoardSnapshotMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/shift-board-snapshot', () => ({
  loadShiftBoardSnapshot: loadShiftBoardSnapshotMock,
}))

vi.mock('@/components/shift-board/ShiftBoardClientPage', () => ({
  default: ({ initialSnapshot }: { initialSnapshot: { currentUserId: string } }) =>
    createElement('div', null, `Therapist swaps for ${initialSnapshot.currentUserId}`),
}))

import TherapistSwapsPage from '@/app/(app)/therapist/swaps/page'

describe('therapist swaps route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the same open-board snapshot loader as the main shift-board route', async () => {
    const supabase = { id: 'server-client' }
    createClientMock.mockResolvedValue(supabase)
    loadShiftBoardSnapshotMock.mockResolvedValue({
      unauthorized: false,
      role: 'therapist',
      requests: [],
      metrics: { unfilled: 0, missingLead: 0 },
      pendingCount: 0,
      currentUserId: 'therapist-2',
      therapists: [],
      employmentType: null,
      scheduledByDateEntries: [],
    })

    const html = renderToStaticMarkup(await TherapistSwapsPage())

    expect(loadShiftBoardSnapshotMock).toHaveBeenCalledWith({ supabase, tab: 'open' })
    expect(html).toContain('Therapist swaps for therapist-2')
  })

  it('redirects to login when the shared shift-board snapshot is unauthorized', async () => {
    createClientMock.mockResolvedValue({ id: 'server-client' })
    loadShiftBoardSnapshotMock.mockResolvedValue({ unauthorized: true })

    await expect(TherapistSwapsPage()).rejects.toThrow('REDIRECT:/login')
  })
})
