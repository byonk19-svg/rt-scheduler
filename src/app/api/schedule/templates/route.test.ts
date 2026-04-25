import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DELETE } from '@/app/api/schedule/templates/[id]/route'
import { POST } from '@/app/api/schedule/templates/route'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

type Scenario = {
  userId?: string | null
  role?: string
  isActive?: boolean | null
  archivedAt?: string | null
}

function makeSupabaseMock(scenario: Scenario = {}) {
  const state = {
    insertedTemplates: [] as Array<Record<string, unknown>>,
    deletedTemplateIds: [] as string[],
  }

  const auth = {
    getUser: async () => ({
      data: {
        user: scenario.userId === null ? null : { id: scenario.userId ?? 'manager-1' },
      },
    }),
  }

  const from = (table: string) => {
    const queryState: {
      op: 'select' | 'insert' | 'delete'
      filters: Record<string, unknown>
      payload: Record<string, unknown> | null
    } = {
      op: 'select',
      filters: {},
      payload: null,
    }

    const resolveSelect = (single: boolean) => {
      if (table === 'profiles') {
        return {
          data:
            scenario.userId === null
              ? null
              : {
                  role: scenario.role ?? 'manager',
                  is_active: scenario.isActive ?? true,
                  archived_at: scenario.archivedAt ?? null,
                },
          error: null,
        }
      }

      if (table === 'schedule_cycles') {
        return {
          data: { id: 'cycle-1', start_date: '2026-03-01' },
          error: null,
        }
      }

      if (table === 'shifts') {
        return {
          data: [
            {
              user_id: 'therapist-1',
              date: '2026-03-01',
              shift_type: 'day',
              role: 'staff',
            },
          ],
          error: null,
        }
      }

      if (table === 'cycle_templates' && queryState.op === 'insert' && single) {
        return {
          data: { id: 'template-1' },
          error: null,
        }
      }

      return {
        data: single ? null : [],
        error: null,
      }
    }

    const resolveMutation = () => {
      if (table === 'cycle_templates' && queryState.op === 'delete') {
        const id = queryState.filters.id
        if (typeof id === 'string') {
          state.deletedTemplateIds.push(id)
        }
      }

      return { data: null, error: null }
    }

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        queryState.filters[column] = value
        return builder
      },
      not: (column: string, operator: string, value: unknown) => {
        queryState.filters[`not:${column}:${operator}`] = value
        return builder
      },
      maybeSingle: async () => resolveSelect(true),
      insert: (payload: Record<string, unknown>) => {
        queryState.op = 'insert'
        queryState.payload = payload
        state.insertedTemplates.push(payload)
        return builder
      },
      delete: () => {
        queryState.op = 'delete'
        return builder
      },
      then: <TResult1, TResult2 = never>(
        onfulfilled?:
          | ((value: {
              data: unknown
              error: { message?: string } | null
            }) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) => {
        const result =
          queryState.op === 'select'
            ? Promise.resolve(resolveSelect(false))
            : Promise.resolve(resolveMutation())
        return result.then(onfulfilled, onrejected)
      },
    }

    return builder
  }

  return { auth, from, state }
}

describe('schedule template mutation security', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects cross-origin template creation before auth work', async () => {
    const response = await POST(
      new Request('http://localhost/api/schedule/templates', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://evil.example',
        },
        body: JSON.stringify({
          cycleId: 'cycle-1',
          name: 'March template',
        }),
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid request origin.',
    })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('rejects cross-origin template deletion before auth work', async () => {
    const response = await DELETE(
      new Request('http://localhost/api/schedule/templates/template-1', {
        method: 'DELETE',
        headers: {
          origin: 'https://evil.example',
        },
      }),
      { params: Promise.resolve({ id: 'template-1' }) }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid request origin.',
    })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('returns 401 for unauthenticated template creation requests', async () => {
    const supabase = makeSupabaseMock({ userId: null })
    vi.mocked(createClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/schedule/templates', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost',
        },
        body: JSON.stringify({
          cycleId: 'cycle-1',
          name: 'March template',
        }),
      })
    )

    expect(response.status).toBe(401)
    expect(supabase.state.insertedTemplates).toHaveLength(0)
  })

  it('returns 403 for non-manager template deletion requests', async () => {
    const supabase = makeSupabaseMock({
      role: 'therapist',
      userId: 'therapist-1',
    })
    vi.mocked(createClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const response = await DELETE(
      new Request('http://localhost/api/schedule/templates/template-1', {
        method: 'DELETE',
        headers: {
          origin: 'http://localhost',
        },
      }),
      { params: Promise.resolve({ id: 'template-1' }) }
    )

    expect(response.status).toBe(403)
    expect(supabase.state.deletedTemplateIds).toHaveLength(0)
  })
})
