import { describe, expect, it, vi } from 'vitest'

import { recordSubmission, touchSubmission } from '@/lib/availability/submission-lifecycle'

function makeSupabase(existing: Record<string, unknown> | null) {
  const state = {
    inserts: [] as unknown[],
    updates: [] as unknown[],
  }
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: existing, error: null })),
        })),
      })),
    })),
    insert: vi.fn(async (payload) => {
      state.inserts.push(payload)
      return { error: null }
    }),
    update: vi.fn((payload) => {
      state.updates.push(payload)
      return {
        eq: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      }
    }),
  }))
  return { supabase: { from }, state }
}

describe('availability submission lifecycle', () => {
  it('records the first Availability Submission with submitted and edited timestamps', async () => {
    const { supabase, state } = makeSupabase(null)

    await recordSubmission(supabase as never, 'therapist-1', 'cycle-1')

    expect(state.inserts).toHaveLength(1)
    expect(state.inserts[0]).toMatchObject({
      therapist_id: 'therapist-1',
      schedule_cycle_id: 'cycle-1',
    })
    expect(state.updates).toHaveLength(0)
  })

  it('touches an existing Availability Submission instead of inserting a duplicate', async () => {
    const { supabase, state } = makeSupabase({ id: 'submission-1' })

    await recordSubmission(supabase as never, 'therapist-1', 'cycle-1')

    expect(state.inserts).toHaveLength(0)
    expect(state.updates).toEqual([expect.objectContaining({ last_edited_at: expect.any(String) })])
  })

  it('does not create a submission when touching a missing row', async () => {
    const { supabase, state } = makeSupabase(null)

    await touchSubmission(supabase as never, 'therapist-1', 'cycle-1')

    expect(state.inserts).toHaveLength(0)
    expect(state.updates).toHaveLength(0)
  })
})
