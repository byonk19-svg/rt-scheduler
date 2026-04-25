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
    createElement('div', null, `Shift board for ${initialSnapshot.currentUserId}`),
}))

import ShiftBoardPage from '@/app/(app)/shift-board/page'

describe('shift-board page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the open-board snapshot and renders the shared client page', async () => {
    const supabase = { id: 'server-client' }
    createClientMock.mockResolvedValue(supabase)
    loadShiftBoardSnapshotMock.mockResolvedValue({
      unauthorized: false,
      role: 'therapist',
      requests: [],
      metrics: { unfilled: 0, missingLead: 0 },
      pendingCount: 0,
      currentUserId: 'therapist-1',
      therapists: [],
      employmentType: null,
      scheduledByDateEntries: [],
    })

    const html = renderToStaticMarkup(await ShiftBoardPage())

    expect(loadShiftBoardSnapshotMock).toHaveBeenCalledWith({ supabase, tab: 'open' })
    expect(html).toContain('Shift board for therapist-1')
  })

  it('redirects unauthenticated users to login', async () => {
    createClientMock.mockResolvedValue({ id: 'server-client' })
    loadShiftBoardSnapshotMock.mockResolvedValue({ unauthorized: true })

    await expect(ShiftBoardPage()).rejects.toThrow('REDIRECT:/login')
  })
})
