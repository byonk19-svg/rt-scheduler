import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Role } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/operational-codes', () => ({
  fetchActiveOperationalDetailMap: vi.fn(async () => new Map()),
}))

vi.mock('@/lib/coverage/draft-inputs', () => ({
  loadDraftInputsForCycle: vi.fn(async () => ({ data: {}, error: null })),
  toDraftInputSupabaseClient: vi.fn((client) => client),
}))

vi.mock('@/lib/coverage/generate-draft', () => ({
  generateDraftForCycle: vi.fn(() => ({})),
}))

vi.mock('@/lib/coverage/pre-flight', () => ({
  summarizePreFlight: vi.fn(() => ({
    unfilledSlots: 0,
    missingLeadSlots: 0,
    forcedMustWorkMisses: 0,
    details: [],
  })),
}))

import { loadScheduleGridData } from './schedule-grid-data'
import {
  buildAvailableCycleOptions,
  buildTherapistGridRows,
  mapShiftToGridStatus,
  selectScheduleCycle,
  shapePreFlightSummary,
} from './schedule-grid-model'

type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
  status: 'draft' | 'preliminary' | 'final'
  archived_at: string | null
  site_id: string
}

type Profile = {
  id: string
  role: Role
  shift_type: 'day' | 'night'
  employment_type?: 'full_time' | 'part_time' | 'prn'
  is_active: boolean
  archived_at: string | null
  site_id: string
  full_name?: string
  on_fmla?: boolean
  max_work_days_per_week?: number
}

const draftCycle: Cycle = {
  id: 'draft-cycle',
  label: 'Draft cycle',
  start_date: '2026-05-04',
  end_date: '2026-05-05',
  published: false,
  status: 'draft',
  archived_at: null,
  site_id: 'site-a',
}

const publishedCycle: Cycle = {
  id: 'published-cycle',
  label: 'Published cycle',
  start_date: '2026-04-20',
  end_date: '2026-04-21',
  published: true,
  status: 'final',
  archived_at: null,
  site_id: 'site-a',
}

const therapistRows: Profile[] = [
  {
    id: 'therapist-1',
    role: 'therapist',
    shift_type: 'day',
    is_active: true,
    archived_at: null,
    site_id: 'site-a',
    full_name: 'Day Therapist',
    employment_type: 'full_time',
    on_fmla: false,
    max_work_days_per_week: 3,
  },
]

function makeSupabaseMock({ viewer, cycles }: { viewer: Profile; cycles: Cycle[] }) {
  const profiles = [viewer, ...therapistRows.filter((profile) => profile.id !== viewer.id)]

  const from = (table: string) => {
    const state: {
      filters: Record<string, unknown>
      inFilters: Record<string, unknown[]>
      orderColumn?: string
    } = { filters: {}, inFilters: {} }

    const applyProfiles = () => {
      let rows = profiles
      if (typeof state.filters.id === 'string') {
        rows = rows.filter((row) => row.id === state.filters.id)
      }
      if (Array.isArray(state.inFilters.role)) {
        rows = rows.filter((row) => state.inFilters.role.includes(row.role))
      }
      if (state.filters.archived_at === null) {
        rows = rows.filter((row) => row.archived_at === null)
      }
      if (typeof state.filters.site_id === 'string') {
        rows = rows.filter((row) => row.site_id === state.filters.site_id)
      }
      if (state.orderColumn === 'full_name') {
        rows = [...rows].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
      }
      return rows
    }

    const applyCycles = () => {
      let rows = cycles
      if (state.filters.archived_at === null) {
        rows = rows.filter((row) => row.archived_at === null)
      }
      if (typeof state.filters.site_id === 'string') {
        rows = rows.filter((row) => row.site_id === state.filters.site_id)
      }
      if (state.orderColumn === 'start_date') {
        rows = [...rows].sort((a, b) => b.start_date.localeCompare(a.start_date))
      }
      return rows
    }

    const resolve = (single: boolean) => {
      if (table === 'profiles') {
        const rows = applyProfiles()
        return Promise.resolve({ data: single ? (rows[0] ?? null) : rows, error: null })
      }
      if (table === 'schedule_cycles') {
        const rows = applyCycles()
        return Promise.resolve({ data: single ? (rows[0] ?? null) : rows, error: null })
      }
      if (table === 'shifts' || table === 'availability_overrides') {
        return Promise.resolve({ data: single ? null : [], error: null })
      }
      return Promise.resolve({ data: single ? null : [], error: null })
    }

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        state.filters[column] = value
        return builder
      },
      is: (column: string, value: unknown) => {
        state.filters[column] = value
        return builder
      },
      in: (column: string, value: unknown[]) => {
        state.inFilters[column] = value
        return builder
      },
      gte: () => builder,
      lte: () => builder,
      not: () => builder,
      order: (column: string) => {
        state.orderColumn = column
        return builder
      },
      maybeSingle: () => resolve(true),
      then: (
        onFulfilled?: (value: { data: unknown; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => resolve(false).then(onFulfilled, onRejected),
    }

    return builder
  }

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: viewer.id } } }),
    },
    from,
  }
}

function setViewer(viewer: Profile, cycles: Cycle[]) {
  vi.mocked(createClient).mockResolvedValue(
    makeSupabaseMock({ viewer, cycles }) as unknown as Awaited<ReturnType<typeof createClient>>
  )
}

describe('loadScheduleGridData visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows managers to load draft schedule cycles', async () => {
    setViewer(
      {
        id: 'manager-1',
        role: 'manager',
        shift_type: 'day',
        is_active: true,
        archived_at: null,
        site_id: 'site-a',
      },
      [draftCycle, publishedCycle]
    )

    const result = await loadScheduleGridData({ cycle: 'draft-cycle', shift: 'day' })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.dataset.cycleId).toBe('draft-cycle')
    expect(result.dataset.isPublished).toBe(false)
    expect(result.dataset.availableCycles.map((cycle) => cycle.id)).toEqual([
      'draft-cycle',
      'published-cycle',
    ])
  })

  it('loads only published schedule cycles for leads', async () => {
    setViewer(
      {
        id: 'lead-1',
        role: 'lead',
        shift_type: 'day',
        is_active: true,
        archived_at: null,
        site_id: 'site-a',
      },
      [draftCycle, publishedCycle]
    )

    const result = await loadScheduleGridData({ cycle: 'draft-cycle', shift: 'day' })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.dataset.cycleId).toBe('published-cycle')
    expect(result.dataset.isPublished).toBe(true)
    expect(result.dataset.availableCycles.map((cycle) => cycle.id)).toEqual(['published-cycle'])
  })

  it('returns an empty state for therapists when no published cycle is available', async () => {
    setViewer(
      {
        id: 'therapist-1',
        role: 'therapist',
        shift_type: 'day',
        is_active: true,
        archived_at: null,
        site_id: 'site-a',
      },
      [draftCycle]
    )

    await expect(loadScheduleGridData({ cycle: 'draft-cycle', shift: 'day' })).resolves.toEqual({
      status: 'no_cycle',
    })
  })

  it('includes employment type so the grid can group PRN therapists at the bottom', async () => {
    setViewer(
      {
        id: 'manager-1',
        role: 'manager',
        shift_type: 'day',
        is_active: true,
        archived_at: null,
        site_id: 'site-a',
      },
      [draftCycle]
    )

    const result = await loadScheduleGridData({ cycle: 'draft-cycle', shift: 'day' })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.dataset.therapistRows[0]?.employmentType).toBe('full_time')
  })
})

describe('schedule grid model helpers', () => {
  it('keeps manager cycle options broad and honors a requested draft cycle', () => {
    const result = selectScheduleCycle({
      cycles: [publishedCycle, draftCycle],
      cycleIdFromUrl: 'draft-cycle',
      canManageCoverage: true,
    })

    expect(result.selectedCycle?.id).toBe('draft-cycle')
    expect(buildAvailableCycleOptions(result.visibleCycles)).toEqual([
      { id: 'published-cycle', label: 'Published cycle' },
      { id: 'draft-cycle', label: 'Draft cycle' },
    ])
  })

  it('limits therapist cycle options to published cycles and ignores requested drafts', () => {
    const result = selectScheduleCycle({
      cycles: [draftCycle, publishedCycle],
      cycleIdFromUrl: 'draft-cycle',
      canManageCoverage: false,
    })

    expect(result.selectedCycle?.id).toBe('published-cycle')
    expect(result.visibleCycles.map((cycle) => cycle.id)).toEqual(['published-cycle'])
  })

  it('prefers draft cycles before published cycles when no cycle is requested for managers', () => {
    const result = selectScheduleCycle({
      cycles: [publishedCycle, draftCycle],
      cycleIdFromUrl: undefined,
      canManageCoverage: true,
    })

    expect(result.selectedCycle?.id).toBe('draft-cycle')
  })

  it('marks requested-off force-off days on matching shift tabs', () => {
    const [row] = buildTherapistGridRows({
      therapists: [
        {
          id: 'therapist-1',
          full_name: 'Day Therapist',
          shift_type: 'day',
          employment_type: 'full_time',
          on_fmla: false,
          is_active: true,
          archived_at: null,
          role: 'therapist',
          max_work_days_per_week: null,
        },
      ],
      cycleDates: ['2026-05-04', '2026-05-05'],
      shiftType: 'day',
      shifts: [],
      forceOffOverrides: [
        { therapist_id: 'therapist-1', date: '2026-05-04', shift_type: 'both' },
        { therapist_id: 'therapist-1', date: '2026-05-05', shift_type: 'day' },
        { therapist_id: 'therapist-1', date: '2026-05-05', shift_type: 'night' },
      ],
      activeOperationalDetails: new Map(),
    })

    expect(row?.cells['2026-05-04']?.hasNeedsOff).toBe(true)
    expect(row?.cells['2026-05-05']?.hasNeedsOff).toBe(true)
  })

  it('lets active operational codes override assignment status and keeps called-off fallback', () => {
    expect(
      mapShiftToGridStatus({
        isLead: false,
        assignmentStatus: 'on_call',
        shiftStatus: 'scheduled',
        operationalCode: 'call_in',
      })
    ).toBe('call_in')
    expect(
      mapShiftToGridStatus({
        isLead: false,
        assignmentStatus: null,
        shiftStatus: 'called_off',
        operationalCode: null,
      })
    ).toBe('cancelled')
  })

  it('marks extra off days ineligible after weekly max work days are reached', () => {
    const [row] = buildTherapistGridRows({
      therapists: [
        {
          id: 'therapist-1',
          full_name: 'Day Therapist',
          shift_type: 'day',
          employment_type: 'full_time',
          on_fmla: false,
          is_active: true,
          archived_at: null,
          role: 'therapist',
          max_work_days_per_week: 2,
        },
      ],
      cycleDates: ['2026-05-04', '2026-05-05', '2026-05-06'],
      shiftType: 'day',
      shifts: [
        {
          id: 'shift-1',
          user_id: 'therapist-1',
          date: '2026-05-04',
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: null,
          role: 'staff',
        },
        {
          id: 'shift-2',
          user_id: 'therapist-1',
          date: '2026-05-05',
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: null,
          role: 'staff',
        },
      ],
      forceOffOverrides: [],
      activeOperationalDetails: new Map(),
    })

    expect(row?.cells['2026-05-06']).toMatchObject({
      status: 'off',
      isIneligible: true,
    })
  })

  it('keeps pre-flight summary shape compatible with the grid contract', () => {
    expect(
      shapePreFlightSummary({
        unfilledSlots: 3,
        missingLeadSlots: 1,
        forcedMustWorkMisses: 2,
        details: [{ date: '2026-05-04', shiftType: 'day', missingCount: 1 }],
      })
    ).toEqual({
      unfilledSlots: 3,
      missingLeadSlots: 1,
      forcedMustWorkMisses: 2,
      details: [{ date: '2026-05-04', shiftType: 'day', missingCount: 1 }],
    })
  })
})
