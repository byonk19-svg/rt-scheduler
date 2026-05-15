import { describe, expect, it } from 'vitest'

import {
  DRAFT_AVAILABILITY_OVERRIDE_COLUMNS,
  DRAFT_EXISTING_SHIFT_COLUMNS,
  DRAFT_THERAPIST_COLUMNS,
  DRAFT_WEEKLY_SHIFT_COLUMNS,
  DRAFT_WORK_PATTERN_COLUMNS,
  buildDraftTherapists,
  loadDraftInputsForCycle,
  toDraftExistingShifts,
} from '@/lib/coverage/draft-inputs'

describe('draft input loader helpers', () => {
  it('keeps the shared draft query columns in one module', () => {
    expect(DRAFT_THERAPIST_COLUMNS).toContain('max_work_days_per_week')
    expect(DRAFT_WORK_PATTERN_COLUMNS).toContain('cycle_segments')
    expect(DRAFT_EXISTING_SHIFT_COLUMNS).toContain('unfilled_reason')
    expect(DRAFT_AVAILABILITY_OVERRIDE_COLUMNS).toContain('source')
    expect(DRAFT_WEEKLY_SHIFT_COLUMNS).toBe('user_id, date, status')
  })

  it('normalizes therapist rows into the generateDraftForCycle input shape', () => {
    const therapists = buildDraftTherapists(
      [
        {
          id: 'therapist-1',
          full_name: 'A Therapist',
          shift_type: 'day',
          is_lead_eligible: null,
          employment_type: null,
          max_work_days_per_week: null,
          on_fmla: null,
          fmla_return_date: null,
          is_active: null,
        },
      ],
      []
    )

    expect(therapists[0]).toMatchObject({
      id: 'therapist-1',
      is_lead_eligible: false,
      employment_type: 'full_time',
      max_work_days_per_week: 0,
      shift_preference: 'either',
      on_fmla: false,
      is_active: true,
    })
  })

  it('keeps PRN therapists without saved work patterns in flexible mode', () => {
    const therapists = buildDraftTherapists(
      [
        {
          id: 'prn-1',
          full_name: 'Flexible PRN',
          shift_type: 'day',
          is_lead_eligible: false,
          employment_type: 'prn',
          max_work_days_per_week: null,
          on_fmla: false,
          fmla_return_date: null,
          is_active: true,
        },
      ],
      []
    )

    expect(therapists[0]?.pattern?.pattern_type).toBe('none')
    expect(therapists[0]?.pattern?.works_dow).toEqual([])
  })

  it('filters unfilled placeholders out of existing draft shifts', () => {
    expect(
      toDraftExistingShifts([
        {
          user_id: null,
          date: '2026-04-07',
          shift_type: 'day',
          status: 'scheduled',
          role: 'staff',
          unfilled_reason: 'no_eligible_candidates_due_to_constraints',
        },
        {
          user_id: 'therapist-1',
          date: '2026-04-07',
          shift_type: 'day',
          status: 'scheduled',
          role: 'staff',
          unfilled_reason: null,
        },
      ])
    ).toEqual([
      {
        user_id: 'therapist-1',
        date: '2026-04-07',
        shift_type: 'day',
        status: 'scheduled',
        role: 'staff',
        unfilled_reason: null,
      },
    ])
  })

  it('loads draft therapists only from the Schedule Block site', async () => {
    const profiles = [
      {
        id: 'site-a-therapist',
        full_name: 'Site A Therapist',
        role: 'therapist',
        shift_type: 'day',
        is_lead_eligible: false,
        employment_type: 'full_time',
        max_work_days_per_week: 3,
        on_fmla: false,
        fmla_return_date: null,
        is_active: true,
        site_id: 'site-a',
      },
      {
        id: 'site-b-therapist',
        full_name: 'Site B Therapist',
        role: 'therapist',
        shift_type: 'day',
        is_lead_eligible: false,
        employment_type: 'full_time',
        max_work_days_per_week: 3,
        on_fmla: false,
        fmla_return_date: null,
        is_active: true,
        site_id: 'site-b',
      },
    ]
    const client = {
      from(table: string) {
        const filters: Record<string, unknown> = {}
        const inFilters: Record<string, unknown[]> = {}
        const builder = {
          select: () => builder,
          eq: (column: string, value: unknown) => {
            filters[column] = value
            return builder
          },
          in: (column: string, values: unknown[]) => {
            inFilters[column] = values
            return builder
          },
          gte: () => builder,
          lte: () => builder,
          order: () => builder,
          then: (
            onFulfilled?: (value: { data: unknown[]; error: null }) => unknown,
            onRejected?: (reason: unknown) => unknown
          ) => {
            let rows: unknown[] = []
            if (table === 'profiles') {
              let profileRows = profiles
              if (Array.isArray(inFilters.role)) {
                profileRows = profileRows.filter((row) => inFilters.role.includes(row.role))
              }
              if (typeof filters.site_id === 'string') {
                profileRows = profileRows.filter((row) => row.site_id === filters.site_id)
              }
              rows = profileRows
            }
            return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected)
          },
        }
        return builder
      },
    }

    const result = await loadDraftInputsForCycle(
      client as Parameters<typeof loadDraftInputsForCycle>[0],
      {
      cycle: {
        id: 'cycle-1',
        start_date: '2026-05-03',
        end_date: '2026-06-13',
        site_id: 'site-a',
      },
      }
    )

    expect(result.error).toBeNull()
    expect(result.data?.therapists.map((therapist) => therapist.id)).toEqual([
      'site-a-therapist',
    ])
  })
})
