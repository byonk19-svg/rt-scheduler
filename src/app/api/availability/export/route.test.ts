import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { GET } from '@/app/api/availability/export/route'

function createSupabaseMock() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'manager-1' } },
      })),
    },
    from(table: string) {
      const builder = {
        select() {
          return builder
        },
        eq() {
          return builder
        },
        in() {
          return builder
        },
        order() {
          return builder
        },
        maybeSingle: async () => {
          if (table === 'profiles') {
            return { data: { role: 'manager' }, error: null }
          }
          return { data: null, error: null }
        },
        then(resolve: (value: unknown) => unknown) {
          if (table === 'availability_overrides') {
            return Promise.resolve(
              resolve({
                data: [
                  {
                    cycle_id: 'cycle-1',
                    therapist_id: 'therapist-1',
                    date: '2026-03-24',
                    override_type: 'force_off',
                    shift_type: 'both',
                    note: 'Doctor',
                    source: 'therapist',
                    created_at: '2026-03-01T08:00:00.000Z',
                    profiles: { full_name: 'Therapist One' },
                    schedule_cycles: {
                      label: 'Block 1',
                      start_date: '2026-03-22',
                      end_date: '2026-05-02',
                    },
                  },
                ],
                error: null,
              })
            )
          }

          if (table === 'therapist_availability_submissions') {
            return Promise.resolve(
              resolve({
                data: [
                  {
                    therapist_id: 'therapist-1',
                    schedule_cycle_id: 'cycle-1',
                    submitted_at: '2026-03-20T15:30:00.000Z',
                  },
                ],
                error: null,
              })
            )
          }

          return Promise.resolve(resolve({ data: null, error: null }))
        },
      }

      return builder
    },
  }
}

describe('GET /api/availability/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports the official submission timestamp instead of override creation time', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock())

    const response = await GET()
    expect(response.status).toBe(200)

    const body = await response.text()
    expect(body).toContain('submitted_at')
    expect(body).toContain('2026-03-20T15:30:00.000Z')
    expect(body).not.toContain('2026-03-01T08:00:00.000Z')
  })
})
