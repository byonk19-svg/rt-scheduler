import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  cycle_id: string
  site_id?: string | null
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
  site_id?: string | null
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
    const rows =
      table === 'profiles'
        ? state.profiles.map((row) => ({ site_id: 'site-a', ...row }))
        : state.shifts.map((row) => ({ site_id: 'site-a', ...row }))

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
        if (filter.op === 'gte') {
          return typeof cell === 'string' && typeof filter.value === 'string'
            ? cell >= filter.value
            : false
        }
        if (filter.op === 'gt') {
          return typeof cell === 'string' && typeof filter.value === 'string'
            ? cell > filter.value
            : false
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
      gte(key: string, value: unknown) {
        filters.push({ op: 'gte', key, value })
        return builder
      },
      gt(key: string, value: unknown) {
        filters.push({ op: 'gt', key, value })
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
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T12:00:00.000Z'))
    createClientMock.mockResolvedValue(createServerClient())
  })

  afterEach(() => {
    vi.useRealTimers()
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
            cycle_id: 'cycle-1',
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
            cycle_id: 'cycle-1',
            user_id: 'therapist-2',
            date: '2026-05-15',
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
        verdict: 'coverage_safe',
        consequence: 'Both shifts stay covered after the exchange.',
        nextMove: null,
        availabilityReason: null,
        currentShiftLabel: 'Currently on May 15 day shift',
        isBestOption: true,
      },
    ])
  })

  it('rejects inactive requesters before exposing teammate candidates', async () => {
    createAdminClientMock.mockReturnValue(
      createAdminClient({
        profiles: [
          {
            id: 'therapist-1',
            full_name: 'Inactive Requester',
            is_lead_eligible: true,
            is_active: false,
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
            cycle_id: 'cycle-1',
            user_id: 'therapist-1',
            date: '2026-05-01',
            shift_type: 'day',
            role: 'lead',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: { published: true },
          },
        ],
      })
    )

    const response = await GET(makeRequest('shift-1', 'swap'))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Shift was not found.' })
  })

  it('rejects requester shifts outside the actor site before exposing teammate candidates', async () => {
    createAdminClientMock.mockReturnValue(
      createAdminClient({
        profiles: [
          {
            id: 'therapist-1',
            full_name: 'Requester',
            is_lead_eligible: true,
            is_active: true,
            role: 'lead',
            shift_type: 'day',
            site_id: 'site-a',
          },
          {
            id: 'therapist-2',
            full_name: 'Other Site Candidate',
            is_lead_eligible: true,
            is_active: true,
            role: 'therapist',
            shift_type: 'day',
            site_id: 'site-b',
          },
        ],
        shifts: [
          {
            id: 'shift-1',
            cycle_id: 'cycle-1',
            site_id: 'site-b',
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
            cycle_id: 'cycle-1',
            site_id: 'site-b',
            user_id: 'therapist-2',
            date: '2026-05-15',
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

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Shift was not found.' })
  })

  it('returns only teammates with a different same-shift-type assignment for direct swaps', async () => {
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
            full_name: 'Same Slot Therapist',
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
          {
            id: 'therapist-5',
            full_name: 'Other Cycle Therapist',
            is_lead_eligible: false,
            is_active: true,
            role: 'therapist',
            shift_type: 'day',
          },
        ],
        shifts: [
          {
            id: 'shift-1',
            cycle_id: 'cycle-1',
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
            cycle_id: 'cycle-1',
            user_id: 'therapist-2',
            date: '2026-05-15',
            shift_type: 'day',
            role: 'staff',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: [{ published: true }],
          },
          {
            id: 'shift-3',
            cycle_id: 'cycle-1',
            user_id: 'therapist-3',
            date: '2026-05-01',
            shift_type: 'day',
            role: 'staff',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: [{ published: true }],
          },
          {
            id: 'shift-4',
            cycle_id: 'cycle-1',
            user_id: 'therapist-4',
            date: '2026-05-01',
            shift_type: 'night',
            role: 'staff',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: [{ published: true }],
          },
          {
            id: 'shift-5',
            cycle_id: 'cycle-2',
            user_id: 'therapist-5',
            date: '2026-05-15',
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
        name: 'Swap Partner',
        avatar: 'SP',
        shift: 'Day',
        isLead: false,
        verdict: 'coverage_safe',
        consequence: 'Both shifts stay covered after the exchange.',
        nextMove: null,
        availabilityReason: null,
        currentShiftLabel: 'Currently on May 15 day shift',
        isBestOption: true,
      },
    ])
  })

  it('surfaces lead-safe teammates first and keeps weaker options visible for review', async () => {
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
            cycle_id: 'cycle-1',
            user_id: 'therapist-1',
            date: '2099-05-02',
            shift_type: 'day',
            role: 'lead',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: [{ published: true }],
          },
          {
            id: 'shift-2',
            cycle_id: 'cycle-1',
            user_id: 'therapist-2',
            date: '2099-05-09',
            shift_type: 'day',
            role: 'staff',
            status: 'scheduled',
            assignment_status: 'scheduled',
            schedule_cycles: [{ published: true }],
          },
          {
            id: 'shift-3',
            cycle_id: 'cycle-1',
            user_id: 'therapist-3',
            date: '2099-05-10',
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
        verdict: 'coverage_safe',
        consequence: 'Both shifts stay covered after the exchange.',
        nextMove: null,
        availabilityReason: null,
        currentShiftLabel: 'Currently on May 9 day shift',
        isBestOption: true,
      },
      {
        id: 'therapist-3',
        name: 'Non Lead Partner',
        avatar: 'NL',
        shift: 'Day',
        isLead: false,
        verdict: 'needs_manager_review',
        consequence: 'Your May 2 day shift would lose its only lead.',
        nextMove: 'Try another lead-qualified teammate if you want a safer swap.',
        availabilityReason: null,
        currentShiftLabel: 'Currently on May 10 day shift',
        isBestOption: false,
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
            cycle_id: 'cycle-1',
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
            cycle_id: 'cycle-1',
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
