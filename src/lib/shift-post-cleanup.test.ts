import { describe, expect, it, vi } from 'vitest'

import { preserveShiftPostHistoryBeforeShiftDeletion } from '@/lib/shift-post-cleanup'

function createSupabaseMock(linkedPosts: Array<{ id: string; status: string }>) {
  const shiftPostUpdates: Array<{ payload: Record<string, unknown>; ids: string[] }> = []
  const shiftPostInterestUpdates: Array<{
    payload: Record<string, unknown>
    ids: string[]
    statuses: string[]
  }> = []

  return {
    shiftPostUpdates,
    shiftPostInterestUpdates,
    from(table: string) {
      if (table === 'shift_posts') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: linkedPosts,
              error: null,
            })),
          })),
          update: vi.fn((payload: Record<string, unknown>) => ({
            in: vi.fn(async (_column: string, ids: string[]) => {
              shiftPostUpdates.push({ payload, ids })
              return { error: null }
            }),
          })),
        }
      }

      if (table === 'shift_post_interests') {
        return {
          update: vi.fn((payload: Record<string, unknown>) => ({
            in: vi.fn((_column: string, ids: string[]) => ({
              in: vi.fn(async (_statusColumn: string, statuses: string[]) => {
                shiftPostInterestUpdates.push({ payload, ids, statuses })
                return { error: null }
              }),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    },
  }
}

describe('preserveShiftPostHistoryBeforeShiftDeletion', () => {
  it('denies pending posts, declines queue interests, and nulls historical shift links', async () => {
    const supabase = createSupabaseMock([
      { id: 'post-pending', status: 'pending' },
      { id: 'post-approved', status: 'approved' },
      { id: 'post-withdrawn', status: 'withdrawn' },
    ])

    await preserveShiftPostHistoryBeforeShiftDeletion(
      supabase as never,
      ['shift-1'],
      'Schedule changed after this request was posted.'
    )

    expect(supabase.shiftPostUpdates).toEqual([
      {
        payload: {
          status: 'denied',
          override_reason: 'Schedule changed after this request was posted.',
          shift_id: null,
        },
        ids: ['post-pending'],
      },
      {
        payload: { shift_id: null },
        ids: ['post-approved', 'post-withdrawn'],
      },
    ])
    expect(supabase.shiftPostInterestUpdates).toEqual([
      {
        payload: expect.objectContaining({
          status: 'declined',
        }),
        ids: ['post-pending'],
        statuses: ['pending', 'selected'],
      },
    ])
  })
})
