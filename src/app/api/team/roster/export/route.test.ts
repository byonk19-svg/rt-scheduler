import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createClient } from '@/lib/supabase/server'

import { GET } from './route'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

type RosterRow = {
  full_name: string | null
  role: string | null
  shift_type: string | null
  employment_type: string | null
  is_lead_eligible: boolean | null
  is_active: boolean | null
  on_fmla: boolean | null
  archived_at: string | null
  phone_number: string | null
  max_work_days_per_week: number | null
  site_id: string
}

const rosterRows: RosterRow[] = [
  {
    full_name: 'Active Therapist',
    role: 'therapist',
    shift_type: 'day',
    employment_type: 'full_time',
    is_lead_eligible: false,
    is_active: true,
    on_fmla: false,
    archived_at: null,
    phone_number: '555-0101',
    max_work_days_per_week: 3,
    site_id: 'site-a',
  },
  {
    full_name: 'Inactive Therapist',
    role: 'therapist',
    shift_type: 'night',
    employment_type: 'part_time',
    is_lead_eligible: false,
    is_active: false,
    on_fmla: false,
    archived_at: null,
    phone_number: '555-0102',
    max_work_days_per_week: 2,
    site_id: 'site-a',
  },
  {
    full_name: 'Archived Therapist',
    role: 'therapist',
    shift_type: 'day',
    employment_type: 'full_time',
    is_lead_eligible: true,
    is_active: false,
    on_fmla: false,
    archived_at: '2026-05-01T12:00:00Z',
    phone_number: '555-0103',
    max_work_days_per_week: 3,
    site_id: 'site-a',
  },
  {
    full_name: 'Other Site Therapist',
    role: 'therapist',
    shift_type: 'day',
    employment_type: 'full_time',
    is_lead_eligible: false,
    is_active: true,
    on_fmla: false,
    archived_at: null,
    phone_number: '555-0104',
    max_work_days_per_week: 3,
    site_id: 'site-b',
  },
]

function makeSupabaseClient(rows = rosterRows) {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'manager-1' } } }),
    },
    from(table: string) {
      const state: {
        filters: Record<string, unknown>
        nullFilters: Record<string, unknown>
        requireRole: boolean
        orderColumn: string | null
      } = {
        filters: {},
        nullFilters: {},
        requireRole: false,
        orderColumn: null,
      }

      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          state.filters[column] = value
          return builder
        },
        is: (column: string, value: unknown) => {
          state.nullFilters[column] = value
          return builder
        },
        not: (column: string, operator: string, value: unknown) => {
          if (column === 'role' && operator === 'is' && value === null) {
            state.requireRole = true
          }
          return builder
        },
        order: (column: string) => {
          state.orderColumn = column
          return builder
        },
        maybeSingle: async () => ({
          data: {
            role: 'manager',
            is_active: true,
            archived_at: null,
            site_id: 'site-a',
          },
          error: null,
        }),
        then: (
          onFulfilled?: (value: { data: RosterRow[]; error: null }) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => {
          let filtered = table === 'profiles' ? [...rows] : []
          for (const [column, value] of Object.entries(state.filters)) {
            filtered = filtered.filter((row) => row[column as keyof RosterRow] === value)
          }
          for (const [column, value] of Object.entries(state.nullFilters)) {
            filtered = filtered.filter((row) => row[column as keyof RosterRow] === value)
          }
          if (state.requireRole) {
            filtered = filtered.filter((row) => row.role !== null)
          }
          if (state.orderColumn === 'full_name') {
            filtered.sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
          }
          return Promise.resolve({ data: filtered, error: null }).then(onFulfilled, onRejected)
        },
      }
      return builder
    },
  }
}

describe('team roster export route', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient() as unknown as Awaited<ReturnType<typeof createClient>>
    )
  })

  it('exports only the manager site roster and keeps lifecycle-aware authorization', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/team/roster/export/route.ts'),
      'utf8'
    )

    expect(source).toContain("select('role, is_active, archived_at, site_id')")
    expect(source).toContain('actorProfile?.site_id')
    expect(source).toContain(".eq('site_id', actorProfile.site_id)")
    expect(source).toContain('archived_at, phone_number')
  })

  it('defaults the CSV to active non-archived staff and labels the scope', async () => {
    const response = await GET(new Request('https://teamwise.test/api/team/roster/export'))
    const csv = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain(
      'team-roster-active-staff-export.csv'
    )
    expect(csv).toContain('archived_at,export_scope')
    expect(csv).toContain('Active Therapist')
    expect(csv).toContain('active_staff')
    expect(csv).not.toContain('Inactive Therapist')
    expect(csv).not.toContain('Archived Therapist')
    expect(csv).not.toContain('Other Site Therapist')
  })

  it('supports an explicitly labeled all-staff roster export for inactive and archived review', async () => {
    const response = await GET(
      new Request('https://teamwise.test/api/team/roster/export?scope=all')
    )
    const csv = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain(
      'team-roster-all-staff-export.csv'
    )
    expect(csv).toContain('Active Therapist')
    expect(csv).toContain('Inactive Therapist')
    expect(csv).toContain('Archived Therapist')
    expect(csv).not.toContain('Other Site Therapist')
    expect(csv).toContain('2026-05-01T12:00:00Z,all_staff')
  })
})
