import { describe, expect, it, vi } from 'vitest'

import {
  ShiftPostCleanupError,
  closePendingShiftPostsForShiftIds,
  preserveShiftPostHistoryBeforeShiftDeletion,
} from '@/lib/shift-post-cleanup'

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
            in: vi.fn(() => {
              const result = {
                data: linkedPosts,
                error: null,
              }
              return {
                eq: vi.fn(async () => result),
                then<TResult1 = typeof result, TResult2 = never>(
                  onfulfilled?: ((value: typeof result) => TResult1 | PromiseLike<TResult1>) | null,
                  onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
                ) {
                  return Promise.resolve(result).then(onfulfilled, onrejected)
                },
              }
            }),
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

  it('fails closed when linked shift posts cannot be loaded before deletion', async () => {
    const supabase = {
      from(table: string) {
        if (table !== 'shift_posts') throw new Error(`Unexpected table ${table}`)
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: null,
              error: { message: 'database unavailable' },
            })),
          })),
        }
      },
    }

    await expect(
      preserveShiftPostHistoryBeforeShiftDeletion(
        supabase as never,
        ['shift-1'],
        'Schedule changed after this request was posted.'
      )
    ).rejects.toBeInstanceOf(ShiftPostCleanupError)
  })
})

describe('closePendingShiftPostsForShiftIds', () => {
  it('denies pending posts and declines pending or selected interests for unique shift ids', async () => {
    const supabase = createSupabaseMock([{ id: 'post-pending', status: 'pending' }])

    await closePendingShiftPostsForShiftIds(
      supabase as never,
      ['shift-1', 'shift-1', '', 'shift-2'],
      'Schedule block was taken offline. Submit a new request after it is republished.'
    )

    expect(supabase.shiftPostUpdates).toEqual([
      {
        payload: {
          status: 'denied',
          override_reason:
            'Schedule block was taken offline. Submit a new request after it is republished.',
        },
        ids: ['post-pending'],
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

  it('fails closed when pending shift posts cannot be denied', async () => {
    const supabase = {
      from(table: string) {
        if (table !== 'shift_posts') throw new Error(`Unexpected table ${table}`)
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [{ id: 'post-pending' }],
                error: null,
              })),
            })),
          })),
          update: vi.fn(() => ({
            in: vi.fn(async () => ({
              error: { message: 'update failed' },
            })),
          })),
        }
      },
    }

    await expect(
      closePendingShiftPostsForShiftIds(
        supabase as never,
        ['shift-1'],
        'Schedule block was taken offline. Submit a new request after it is republished.'
      )
    ).rejects.toBeInstanceOf(ShiftPostCleanupError)
  })
})
