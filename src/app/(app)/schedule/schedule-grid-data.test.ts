import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Role } from '@/lib/auth/roles'
import { loadDraftInputsForCycle } from '@/lib/coverage/draft-inputs'
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
    readinessIssues: [],
  })),
}))

vi.mock('@/lib/coverage/readiness-issues', () => ({
  buildReadinessIssues: vi.fn(() => []),
}))

import { loadScheduleGridData } from './schedule-grid-data'
import {
  buildAvailableCycleOptions,
  buildTherapistGridRows,
  mapShiftToGridStatus,
  resolveScheduleInteractionMode,
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
  is_lead_eligible?: boolean | null
  max_work_days_per_week?: number
}

type ScheduleGridReadFailures = {
  viewerProfile?: unknown
  cycles?: unknown
  therapists?: unknown
  shifts?: unknown
  forceOff?: unknown
}

type ScheduleShift = {
  id: string
  user_id: string | null
  cycle_id: string
  date: string
  shift_type: 'day' | 'night'
  status: 'scheduled'
  assignment_status: null
  role: 'staff' | 'lead'
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
    is_lead_eligible: false,
    max_work_days_per_week: 3,
  },
]

function makeSupabaseMock({
  viewer,
  cycles,
  therapistProfiles = therapistRows,
  shiftRows = [],
  failures = {},
}: {
  viewer: Profile
  cycles: Cycle[]
  therapistProfiles?: Profile[]
  shiftRows?: ScheduleShift[]
  failures?: ScheduleGridReadFailures
}) {
  const profiles = [viewer, ...therapistProfiles.filter((profile) => profile.id !== viewer.id)]

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
        if (single && typeof state.filters.id === 'string' && failures.viewerProfile) {
          return Promise.resolve({ data: null, error: failures.viewerProfile })
        }
        if (!single && Array.isArray(state.inFilters.role) && failures.therapists) {
          return Promise.resolve({ data: null, error: failures.therapists })
        }
        const rows = applyProfiles()
        return Promise.resolve({ data: single ? (rows[0] ?? null) : rows, error: null })
      }
      if (table === 'schedule_cycles') {
        if (failures.cycles) {
          return Promise.resolve({ data: null, error: failures.cycles })
        }
        const rows = applyCycles()
        return Promise.resolve({ data: single ? (rows[0] ?? null) : rows, error: null })
      }
      if (table === 'shifts') {
        if (failures.shifts) {
          return Promise.resolve({ data: null, error: failures.shifts })
        }
        let rows = shiftRows
        if (typeof state.filters.cycle_id === 'string') {
          rows = rows.filter((row) => row.cycle_id === state.filters.cycle_id)
        }
        if (typeof state.filters.shift_type === 'string') {
          rows = rows.filter((row) => row.shift_type === state.filters.shift_type)
        }
        return Promise.resolve({ data: single ? null : rows, error: null })
      }
      if (table === 'availability_overrides') {
        if (failures.forceOff) {
          return Promise.resolve({ data: null, error: failures.forceOff })
        }
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
        onFulfilled?: (value: { data: unknown; error: unknown }) => unknown,
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

function setViewer(viewer: Profile, cycles: Cycle[], failures?: ScheduleGridReadFailures) {
  vi.mocked(createClient).mockResolvedValue(
    makeSupabaseMock({ viewer, cycles, failures }) as unknown as Awaited<
      ReturnType<typeof createClient>
    >
  )
}

function setScheduleViewer({
  viewer,
  cycles,
  therapistProfiles,
  shiftRows,
  failures,
}: {
  viewer: Profile
  cycles: Cycle[]
  therapistProfiles?: Profile[]
  shiftRows?: ScheduleShift[]
  failures?: ScheduleGridReadFailures
}) {
  vi.mocked(createClient).mockResolvedValue(
    makeSupabaseMock({
      viewer,
      cycles,
      therapistProfiles,
      shiftRows,
      failures,
    }) as unknown as Awaited<ReturnType<typeof createClient>>
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

  it('builds manager pre-flight summaries from active non-FMLA non-archived draft candidates', async () => {
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
    expect(vi.mocked(loadDraftInputsForCycle)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        therapistScope: 'active-non-fmla',
      })
    )
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

  it.each([
    ['viewer profile', { viewerProfile: { message: 'profile read failed' } }],
    ['schedule cycles', { cycles: { message: 'cycle read failed' } }],
    ['therapist roster', { therapists: { message: 'therapist read failed' } }],
    ['shift assignments', { shifts: { message: 'shift read failed' } }],
    ['Need Off overrides', { forceOff: { message: 'force-off read failed' } }],
  ] satisfies Array<[string, ScheduleGridReadFailures]>)(
    'surfaces %s read failures instead of returning empty schedule data',
    async (_label, failures) => {
      setViewer(
        {
          id: 'manager-1',
          role: 'manager',
          shift_type: 'day',
          is_active: true,
          archived_at: null,
          site_id: 'site-a',
        },
        [draftCycle],
        failures
      )

      await expect(loadScheduleGridData({ cycle: 'draft-cycle', shift: 'day' })).resolves.toEqual({
        status: 'load_error',
      })
    }
  )

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
    expect(result.dataset.therapistRows[0]?.isLeadEligible).toBe(false)
  })

  it('hides inactive unarchived therapists from draft schedule planning when they have no assignments', async () => {
    setScheduleViewer({
      viewer: {
        id: 'manager-1',
        role: 'manager',
        shift_type: 'day',
        is_active: true,
        archived_at: null,
        site_id: 'site-a',
      },
      cycles: [draftCycle],
      therapistProfiles: [
        ...therapistRows,
        {
          id: 'inactive-1',
          role: 'therapist',
          shift_type: 'day',
          is_active: false,
          archived_at: null,
          site_id: 'site-a',
          full_name: 'Inactive Therapist',
          employment_type: 'full_time',
          on_fmla: false,
          max_work_days_per_week: 3,
        },
      ],
    })

    const result = await loadScheduleGridData({ cycle: 'draft-cycle', shift: 'day' })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.dataset.therapistRows.map((row) => row.userId)).toEqual(['therapist-1'])
  })

  it('keeps inactive therapists visible in draft schedule planning when the block already has their assignment', async () => {
    setScheduleViewer({
      viewer: {
        id: 'manager-1',
        role: 'manager',
        shift_type: 'day',
        is_active: true,
        archived_at: null,
        site_id: 'site-a',
      },
      cycles: [draftCycle],
      therapistProfiles: [
        ...therapistRows,
        {
          id: 'inactive-1',
          role: 'therapist',
          shift_type: 'day',
          is_active: false,
          archived_at: null,
          site_id: 'site-a',
          full_name: 'Inactive Therapist',
          employment_type: 'full_time',
          on_fmla: false,
          max_work_days_per_week: 3,
        },
      ],
      shiftRows: [
        {
          id: 'shift-inactive-1',
          user_id: 'inactive-1',
          cycle_id: 'draft-cycle',
          date: '2026-05-04',
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: null,
          role: 'staff',
        },
      ],
    })

    const result = await loadScheduleGridData({ cycle: 'draft-cycle', shift: 'day' })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    const inactiveRow = result.dataset.therapistRows.find((row) => row.userId === 'inactive-1')
    expect(inactiveRow).toMatchObject({
      name: 'Inactive Therapist',
      isActive: false,
    })
    expect(inactiveRow?.cells['2026-05-04']).toMatchObject({
      shiftId: 'shift-inactive-1',
      status: 'staff',
      isIneligible: false,
    })
    expect(inactiveRow?.cells['2026-05-05']).toMatchObject({
      status: 'off',
      isIneligible: true,
      ineligibleReason: 'inactive',
    })
  })

  it('keeps inactive therapists visible on published schedules for historical schedule review', async () => {
    setScheduleViewer({
      viewer: {
        id: 'manager-1',
        role: 'manager',
        shift_type: 'day',
        is_active: true,
        archived_at: null,
        site_id: 'site-a',
      },
      cycles: [publishedCycle],
      therapistProfiles: [
        ...therapistRows,
        {
          id: 'inactive-1',
          role: 'therapist',
          shift_type: 'day',
          is_active: false,
          archived_at: null,
          site_id: 'site-a',
          full_name: 'Inactive Therapist',
          employment_type: 'full_time',
          on_fmla: false,
          max_work_days_per_week: 3,
        },
      ],
    })

    const result = await loadScheduleGridData({ cycle: 'published-cycle', shift: 'day' })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.dataset.therapistRows.map((row) => row.userId)).toContain('inactive-1')
  })
})

describe('schedule grid model helpers', () => {
  it('resolves manager mode with structural and status actions enabled', () => {
    expect(
      resolveScheduleInteractionMode({
        canManageCoverage: true,
        canUpdateAssignmentStatus: true,
        isPublished: false,
      })
    ).toEqual({
      kind: 'manager_edit',
      canUseManagerToolbar: true,
      canAssignShifts: true,
      canUnassignShifts: true,
      canDesignateLead: true,
      canUpdateAssignmentStatus: true,
    })

    expect(
      resolveScheduleInteractionMode({
        canManageCoverage: true,
        canUpdateAssignmentStatus: true,
        isPublished: true,
      }).kind
    ).toBe('manager_edit')
  })

  it('resolves lead status mode only for published schedules', () => {
    expect(
      resolveScheduleInteractionMode({
        canManageCoverage: false,
        canUpdateAssignmentStatus: true,
        isPublished: true,
      })
    ).toMatchObject({
      kind: 'lead_status',
      canAssignShifts: false,
      canUnassignShifts: false,
      canDesignateLead: false,
      canUpdateAssignmentStatus: true,
    })

    expect(
      resolveScheduleInteractionMode({
        canManageCoverage: false,
        canUpdateAssignmentStatus: true,
        isPublished: false,
      }).kind
    ).toBe('staff_view')
  })

  it('keeps staff and future combined schedule views read-only', () => {
    expect(
      resolveScheduleInteractionMode({
        canManageCoverage: false,
        canUpdateAssignmentStatus: false,
        isPublished: true,
      })
    ).toEqual({
      kind: 'staff_view',
      canUseManagerToolbar: false,
      canAssignShifts: false,
      canUnassignShifts: false,
      canDesignateLead: false,
      canUpdateAssignmentStatus: false,
    })

    expect(
      resolveScheduleInteractionMode({
        canManageCoverage: true,
        canUpdateAssignmentStatus: true,
        isPublished: true,
        viewMode: 'combined',
      })
    ).toEqual({
      kind: 'combined_readonly',
      canUseManagerToolbar: false,
      canAssignShifts: false,
      canUnassignShifts: false,
      canDesignateLead: false,
      canUpdateAssignmentStatus: false,
    })
  })

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

  it('marks Need Off force-off days on matching shift tabs', () => {
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

  it('marks FMLA off days ineligible with an explicit reason', () => {
    const [row] = buildTherapistGridRows({
      therapists: [
        {
          id: 'therapist-1',
          full_name: 'FMLA Therapist',
          shift_type: 'day',
          employment_type: 'full_time',
          on_fmla: true,
          is_active: true,
          archived_at: null,
          role: 'therapist',
          max_work_days_per_week: null,
        },
      ],
      cycleDates: ['2026-05-04'],
      shiftType: 'day',
      shifts: [],
      forceOffOverrides: [],
      activeOperationalDetails: new Map(),
    })

    expect(row?.cells['2026-05-04']).toMatchObject({
      status: 'off',
      isIneligible: true,
      ineligibleReason: 'fmla',
    })
  })

  it('maps shift and assignment status combinations to the current grid cell status', () => {
    const cases = [
      {
        label: 'scheduled staff assignment',
        isLead: false,
        assignmentStatus: 'scheduled',
        shiftStatus: 'scheduled',
        operationalCode: null,
        expected: 'staff',
      },
      {
        label: 'scheduled lead assignment',
        isLead: true,
        assignmentStatus: 'scheduled',
        shiftStatus: 'scheduled',
        operationalCode: null,
        expected: 'lead',
      },
      {
        label: 'staff shift without an assignment status',
        isLead: false,
        assignmentStatus: null,
        shiftStatus: 'scheduled',
        operationalCode: null,
        expected: 'staff',
      },
      {
        label: 'assignment status on call',
        isLead: false,
        assignmentStatus: 'on_call',
        shiftStatus: 'scheduled',
        operationalCode: null,
        expected: 'on_call',
      },
      {
        label: 'legacy shift status on call',
        isLead: false,
        assignmentStatus: null,
        shiftStatus: 'on_call',
        operationalCode: null,
        expected: 'on_call',
      },
      {
        label: 'assignment status cancelled',
        isLead: false,
        assignmentStatus: 'cancelled',
        shiftStatus: 'scheduled',
        operationalCode: null,
        expected: 'cancelled',
      },
      {
        label: 'assignment status call in',
        isLead: false,
        assignmentStatus: 'call_in',
        shiftStatus: 'scheduled',
        operationalCode: null,
        expected: 'call_in',
      },
      {
        label: 'assignment status left early',
        isLead: false,
        assignmentStatus: 'left_early',
        shiftStatus: 'scheduled',
        operationalCode: null,
        expected: 'left_early',
      },
      {
        label: 'legacy called off fallback',
        isLead: false,
        assignmentStatus: null,
        shiftStatus: 'called_off',
        operationalCode: null,
        expected: 'cancelled',
      },
      {
        label: 'active operational code overrides assignment status',
        isLead: false,
        assignmentStatus: 'on_call',
        shiftStatus: 'scheduled',
        operationalCode: 'call_in',
        expected: 'call_in',
      },
    ] as const

    for (const testCase of cases) {
      expect(
        mapShiftToGridStatus({
          isLead: testCase.isLead,
          assignmentStatus: testCase.assignmentStatus,
          shiftStatus: testCase.shiftStatus,
          operationalCode: testCase.operationalCode,
        }),
        testCase.label
      ).toBe(testCase.expected)
    }
  })

  it('does not let unrelated operational details override assignment status', () => {
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
      cycleDates: ['2026-05-04'],
      shiftType: 'day',
      shifts: [
        {
          id: 'shift-1',
          user_id: 'therapist-1',
          date: '2026-05-04',
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'cancelled',
          role: 'staff',
        },
      ],
      forceOffOverrides: [],
      activeOperationalDetails: new Map([
        ['other-shift', { code: 'call_in', note: null, leftEarlyTime: null }],
      ]),
    })

    expect(row?.cells['2026-05-04']?.status).toBe('cancelled')
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
      ineligibleReason: 'weekly_limit',
    })
  })

  it('keeps pre-flight summary shape compatible with the grid contract', () => {
    expect(
      shapePreFlightSummary({
        unfilledSlots: 3,
        missingLeadSlots: 1,
        forcedMustWorkMisses: 2,
        details: [{ date: '2026-05-04', shiftType: 'day', missingCount: 1 }],
        readinessIssues: [
          {
            id: 'unfilled-assignment:2026-05-04:day',
            severity: 'blocking',
            type: 'unfilled_assignment',
            date: '2026-05-04',
            shiftType: 'day',
            role: 'staff',
            title: 'Day shift is short 1 assignment',
            detail:
              'Day shift on 2026-05-04 is projected to miss minimum staffing by 1 assignment.',
          },
        ],
      })
    ).toEqual({
      unfilledSlots: 3,
      missingLeadSlots: 1,
      forcedMustWorkMisses: 2,
      details: [{ date: '2026-05-04', shiftType: 'day', missingCount: 1 }],
      readinessIssues: [
        {
          id: 'unfilled-assignment:2026-05-04:day',
          severity: 'blocking',
          type: 'unfilled_assignment',
          date: '2026-05-04',
          shiftType: 'day',
          role: 'staff',
          title: 'Day shift is short 1 assignment',
          detail: 'Day shift on 2026-05-04 is projected to miss minimum staffing by 1 assignment.',
        },
      ],
    })
  })
})
