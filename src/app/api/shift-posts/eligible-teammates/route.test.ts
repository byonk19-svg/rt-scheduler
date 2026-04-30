import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock, createAdminClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

import { GET } from '@/app/api/shift-posts/eligible-teammates/route'

type TestShiftRow = {
  id: string
  user_id: string | null
  date: string
  shift_type: 'day' | 'night'
  role: 'lead' | 'staff'
  status: string | null
  assignment_status: string | null
  schedule_cycles?: { published: boolean } | { published: boolean }[] | null
}

type TestProfileRow = {
  id: string
  full_name: string | null
  is_lead_eligible: boolean | null
  is_active: boolean | null
  archived_at?: string | null
  role?: string | null
  shift_type?: 'day' | 'night' | null
}

type TestState = {
  profiles: TestProfileRow[]
  shifts: TestShiftRow[]
}

function isPublishedScheduleCycle(
  cycle: TestShiftRow['schedule_cycles'],
  expected: unknown
): boolean {
  if (Array.isArray(cycle)) {
    return cycle.some((row) => row.published === expected)
  }

  return cycle?.published === expected
}

function makeRequest(shiftId: string, requestType: 'swap' | 'pickup') {
  return new Request(
    `https://teamwise.test/api/shift-posts/eligible-teammates?shiftId=${shiftId}&requestType=${requestType}`
  )
}

function createServerClient(userId = 'therapist-1') {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: userId } },
      })),
    },
  } as never
}

function createAdminClient(state: TestState) {
  function runQuery(table: string, filters: Array<{ op: string; key: string; value: unknown }>) {
    const rows = table === 'profiles' ? state.profiles : state.shifts

    return rows.filter((row) =>
      filters.every((filter) => {
        const cell =
          filter.key === 'schedule_cycles.published'
            ? isPublishedScheduleCycle((row as TestShiftRow).schedule_cycles, filter.value)
            : (row as Record<string, unknown>)[filter.key]

        if (filter.op === 'eq') {
          return cell === filter.value
        }
        if (filter.op === 'neq') {
          return cell !== filter.value
        }
        if (filter.op === 'is') {
          return (cell ?? null) === filter.value
        }
        if (filter.op === 'in') {
          return Array.isArray(filter.value) && filter.value.includes(cell)
        }
        return true
      })
    )
  }

  function buildQuery(table: string) {
    const filters: Array<{ op: string; key: string; value: unknown }> = []
    let head = false

    const builder = {
      select(_columns: string, options?: { head?: boolean }) {
        head = options?.head === true
        return builder
      },
      eq(key: string, value: unknown) {
        filters.push({ op: 'eq', key, value })
        return builder
      },
      neq(key: string, value: unknown) {
        filters.push({ op: 'neq', key, value })
        return builder
      },
      is(key: string, value: unknown) {
        filters.push({ op: 'is', key, value })
        return builder
      },
      in(key: string, value: unknown[]) {
        filters.push({ op: 'in', key, value })
        return builder
      },
      async maybeSingle() {
        const rows = runQuery(table, filters)
        return { data: rows[0] ?? null, error: null }
      },
      then(resolve: (value: unknown) => unknown) {
        const rows = runQuery(table, filters)
        return Promise.resolve(
          resolve(
            head ? { data: null, error: null, count: rows.length } : { data: rows, error: null }
          )
        )
      },
    }

    return builder
  }

  return {
    from(table: string) {
      return buildQuery(table)
    },
  }
}

describe('eligible request teammates API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createClientMock.mockResolvedValue(createServerClient())
  })

  it('loads therapist teammates when the published cycle join is returned as an object', async () => {
    createAdminClientMock.mockReturnValue(
      createAdminClient({
        profiles: [
          {
            id: 'therapist-1',
            full_name: 'Lead Requester',
            is_lead_eligible: true,
            is_active: true,
            role: 'lead',
            shift_type: 'day',
          },
          {
            id: 'therapist-2',
            full_name: 'Therapist Two',
            is_lead_eligible: true,
            is_active: true,
            role: 'therapist',
            shift_type: 'day',
          },
        ],
        shifts: [
          {
            id: 'shift-1',
            user_id: 'therapist-1',
            date: '2026-05-01',
            shift_type: 'day',
            role: 'lead',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: { published: true },
          },
          {
            id: 'shift-2',
            user_id: 'therapist-2',
            date: '2026-05-01',
            shift_type: 'day',
            role: 'staff',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: { published: true },
          },
        ],
      })
    )

    const response = await GET(makeRequest('shift-1', 'swap'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.teammates).toEqual([
      {
        id: 'therapist-2',
        name: 'Therapist Two',
        avatar: 'TT',
        shift: 'Day',
        isLead: true,
      },
    ])
  })

  it('returns only same-date same-shift teammates for direct swaps', async () => {
    createAdminClientMock.mockReturnValue(
      createAdminClient({
        profiles: [
          {
            id: 'therapist-1',
            full_name: 'Requester',
            is_lead_eligible: false,
            is_active: true,
            role: 'therapist',
            shift_type: 'day',
          },
          {
            id: 'therapist-2',
            full_name: 'Swap Partner',
            is_lead_eligible: false,
            is_active: true,
            role: 'therapist',
            shift_type: 'day',
          },
          {
            id: 'therapist-3',
            full_name: 'Off Day Therapist',
            is_lead_eligible: false,
            is_active: true,
            role: 'therapist',
            shift_type: 'day',
          },
          {
            id: 'therapist-4',
            full_name: 'Night Therapist',
            is_lead_eligible: false,
            is_active: true,
            role: 'therapist',
            shift_type: 'night',
          },
        ],
        shifts: [
          {
            id: 'shift-1',
            user_id: 'therapist-1',
            date: '2026-05-01',
            shift_type: 'day',
            role: 'staff',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: [{ published: true }],
          },
          {
            id: 'shift-2',
            user_id: 'therapist-2',
            date: '2026-05-01',
            shift_type: 'day',
            role: 'staff',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: [{ published: true }],
          },
          {
            id: 'shift-4',
            user_id: 'therapist-4',
            date: '2026-05-01',
            shift_type: 'night',
            role: 'staff',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: [{ published: true }],
          },
        ],
      })
    )

    const response = await GET(makeRequest('shift-1', 'swap'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.teammates).toEqual([
      {
        id: 'therapist-2',
        name: 'Swap Partner',
        avatar: 'SP',
        shift: 'Day',
        isLead: false,
      },
    ])
  })

  it('keeps lone lead direct requests limited to lead-eligible teammates', async () => {
    createAdminClientMock.mockReturnValue(
      createAdminClient({
        profiles: [
          {
            id: 'therapist-1',
            full_name: 'Lead Requester',
            is_lead_eligible: true,
            is_active: true,
            role: 'lead',
            shift_type: 'day',
          },
          {
            id: 'therapist-2',
            full_name: 'Lead Eligible Partner',
            is_lead_eligible: true,
            is_active: true,
            role: 'therapist',
            shift_type: 'day',
          },
          {
            id: 'therapist-3',
            full_name: 'Non Lead Partner',
            is_lead_eligible: false,
            is_active: true,
            role: 'therapist',
            shift_type: 'day',
          },
        ],
        shifts: [
          {
            id: 'shift-1',
            user_id: 'therapist-1',
            date: '2026-05-02',
            shift_type: 'day',
            role: 'lead',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: [{ published: true }],
          },
          {
            id: 'shift-2',
            user_id: 'therapist-2',
            date: '2026-05-02',
            shift_type: 'day',
            role: 'staff',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: [{ published: true }],
          },
          {
            id: 'shift-3',
            user_id: 'therapist-3',
            date: '2026-05-02',
            shift_type: 'day',
            role: 'staff',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: [{ published: true }],
          },
        ],
      })
    )

    const response = await GET(makeRequest('shift-1', 'swap'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.teammates).toEqual([
      {
        id: 'therapist-2',
        name: 'Lead Eligible Partner',
        avatar: 'LE',
        shift: 'Day',
        isLead: true,
      },
    ])
  })

  it('excludes already scheduled teammates from direct pickups', async () => {
    createAdminClientMock.mockReturnValue(
      createAdminClient({
        profiles: [
          {
            id: 'therapist-1',
            full_name: 'Requester',
            is_lead_eligible: false,
            is_active: true,
            role: 'therapist',
            shift_type: 'day',
          },
          {
            id: 'therapist-2',
            full_name: 'Off Day Therapist',
            is_lead_eligible: false,
            is_active: true,
            role: 'therapist',
            shift_type: 'day',
          },
          {
            id: 'therapist-3',
            full_name: 'Already Scheduled Therapist',
            is_lead_eligible: false,
            is_active: true,
            role: 'therapist',
            shift_type: 'day',
          },
        ],
        shifts: [
          {
            id: 'shift-1',
            user_id: 'therapist-1',
            date: '2026-05-03',
            shift_type: 'day',
            role: 'staff',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: [{ published: true }],
          },
          {
            id: 'shift-3',
            user_id: 'therapist-3',
            date: '2026-05-03',
            shift_type: 'day',
            role: 'staff',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: [{ published: true }],
          },
        ],
      })
    )

    const response = await GET(makeRequest('shift-1', 'pickup'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.teammates).toEqual([
      {
        id: 'therapist-2',
        name: 'Off Day Therapist',
        avatar: 'OD',
        shift: 'Day',
        isLead: false,
      },
    ])
  })
})
