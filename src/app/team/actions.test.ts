import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, revalidatePathMock, createClientMock, parseTherapistRosterSourceMock } =
  vi.hoisted(() => ({
    redirectMock: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`)
    }),
    revalidatePathMock: vi.fn(),
    createClientMock: vi.fn(),
    parseTherapistRosterSourceMock: vi.fn(),
  }))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/therapist-roster-source', () => ({
  parseTherapistRosterSource: parseTherapistRosterSourceMock,
}))

import { replaceTherapistRosterAction, upsertEmployeeRosterEntryAction } from '@/app/team/actions'

type TestContext = {
  userId?: string | null
  role?: string | null
  isActive?: boolean | null
  archivedAt?: string | null
  therapistLeadRosterRows?: Array<Record<string, unknown>>
  activeTherapistLeadProfiles?: Array<Record<string, unknown>>
  namedRosterRows?: Array<Record<string, unknown>>
  draftCycleRows?: Array<Record<string, unknown>>
  employeeRosterUpsertError?: { message: string } | null
  employeeRosterDeleteError?: { message: string } | null
  profileArchiveError?: { message: string } | null
}

function createSupabaseMock(context: TestContext = {}) {
  const state = {
    updates: [] as Array<{
      table: string
      payload: Record<string, unknown>
      filters: Record<string, unknown>
    }>,
    deletes: [] as Array<{
      table: string
      filters: Record<string, unknown>
    }>,
    upserts: [] as Array<{
      table: string
      payload: Record<string, unknown> | Array<Record<string, unknown>>
      options?: Record<string, unknown>
    }>,
    employeeRosterDeleteCalls: 0,
  }

  return {
    state,
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: context.userId ? { id: context.userId } : null,
        },
      })),
    },
    from(table: string) {
      const filters = new Map<string, unknown>()
      let selected = '*'

      const builder = {
        select(selection?: string) {
          selected = selection ?? '*'
          return builder
        },
        eq(column: string, value: unknown) {
          filters.set(column, value)
          return builder
        },
        in(column: string, values: unknown[]) {
          filters.set(column, values)
          return builder
        },
        is(column: string, value: unknown) {
          filters.set(`is:${column}`, value)
          return builder
        },
        maybeSingle: async () => {
          if (table === 'profiles' && selected === 'role, is_active, archived_at') {
            return {
              data: {
                role: context.role ?? null,
                is_active: context.isActive ?? true,
                archived_at: context.archivedAt ?? null,
              },
              error: null,
            }
          }

          return { data: null, error: null }
        },
        then(resolve: (value: { data: unknown; error: unknown }) => unknown) {
          if (table === 'schedule_cycles' && selected === 'id') {
            return Promise.resolve(
              resolve({
                data: context.draftCycleRows ?? [],
                error: null,
              })
            )
          }

          if (
            table === 'employee_roster' &&
            selected ===
              'id, full_name, normalized_full_name, phone_number, role, shift_type, employment_type, max_work_days_per_week, is_lead_eligible, is_active, matched_profile_id, matched_email, matched_at, created_by, updated_by'
          ) {
            return Promise.resolve(
              resolve({
                data: context.therapistLeadRosterRows ?? [],
                error: null,
              })
            )
          }

          if (table === 'employee_roster' && selected === 'id, normalized_full_name, role') {
            return Promise.resolve(
              resolve({
                data: context.namedRosterRows ?? [],
                error: null,
              })
            )
          }

          if (table === 'profiles' && selected === 'id, full_name') {
            return Promise.resolve(
              resolve({
                data: context.activeTherapistLeadProfiles ?? [],
                error: null,
              })
            )
          }

          return Promise.resolve(resolve({ data: null, error: null }))
        },
        update(payload: Record<string, unknown>) {
          const updateBuilder = {
            eq(column: string, value: unknown) {
              filters.set(column, value)
              return updateBuilder
            },
            in(column: string, values: unknown[]) {
              filters.set(column, values)
              return updateBuilder
            },
            is(column: string, value: unknown) {
              filters.set(`is:${column}`, value)
              return updateBuilder
            },
            then(resolve: (value: unknown) => unknown) {
              state.updates.push({
                table,
                payload,
                filters: Object.fromEntries(filters.entries()),
              })
              return Promise.resolve(
                resolve({
                  error: table === 'profiles' ? (context.profileArchiveError ?? null) : null,
                })
              )
            },
          }

          return updateBuilder
        },
        delete() {
          const deleteBuilder = {
            eq(column: string, value: unknown) {
              filters.set(column, value)
              return deleteBuilder
            },
            gte(column: string, value: unknown) {
              filters.set(`gte:${column}`, value)
              return deleteBuilder
            },
            in(column: string, values: unknown[]) {
              filters.set(column, values)
              return deleteBuilder
            },
            is(column: string, value: unknown) {
              filters.set(`is:${column}`, value)
              return deleteBuilder
            },
            then(resolve: (value: unknown) => unknown) {
              state.deletes.push({
                table,
                filters: Object.fromEntries(filters.entries()),
              })
              if (table === 'employee_roster') {
                state.employeeRosterDeleteCalls += 1
              }
              return Promise.resolve(
                resolve({
                  error:
                    table === 'employee_roster' && state.employeeRosterDeleteCalls === 1
                      ? (context.employeeRosterDeleteError ?? null)
                      : null,
                })
              )
            },
          }

          return deleteBuilder
        },
        upsert(
          payload: Record<string, unknown> | Array<Record<string, unknown>>,
          options?: Record<string, unknown>
        ) {
          state.upserts.push({ table, payload, options })
          return Promise.resolve({
            error: table === 'employee_roster' ? (context.employeeRosterUpsertError ?? null) : null,
          })
        },
      }

      return builder
    },
  }
}

function makeReplaceFormData(source = 'Brooks, Tannie 903-217-7833') {
  const formData = new FormData()
  formData.set('therapist_roster_source', source)
  return formData
}

function makeRosterEntryFormData() {
  const formData = new FormData()
  formData.set('full_name', 'Jane Doe')
  formData.set('phone_number', '(555) 101-2020')
  formData.set('role', 'therapist')
  formData.set('shift_type', 'day')
  formData.set('employment_type', 'full_time')
  formData.set('max_work_days_per_week', '3')
  return formData
}

describe('upsertEmployeeRosterEntryAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores the optional phone number with the roster entry', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
    })
    createClientMock.mockResolvedValue(supabase)

    await expect(upsertEmployeeRosterEntryAction(makeRosterEntryFormData())).rejects.toThrow(
      'REDIRECT:/team?success=roster_saved'
    )

    expect(supabase.state.upserts).toEqual([
      {
        table: 'employee_roster',
        payload: {
          full_name: 'Jane Doe',
          normalized_full_name: 'jane doe',
          phone_number: '(555) 101-2020',
          role: 'therapist',
          shift_type: 'day',
          employment_type: 'full_time',
          max_work_days_per_week: 3,
          is_lead_eligible: false,
          is_active: true,
          updated_by: 'manager-1',
          created_by: 'manager-1',
        },
        options: { onConflict: 'normalized_full_name' },
      },
    ])
  })
})

describe('replaceTherapistRosterAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires manager access', async () => {
    const supabase = createSupabaseMock({
      userId: 'therapist-1',
      role: 'therapist',
    })
    createClientMock.mockResolvedValue(supabase)

    await expect(replaceTherapistRosterAction(makeReplaceFormData())).rejects.toThrow(
      'REDIRECT:/dashboard/staff'
    )

    expect(parseTherapistRosterSourceMock).not.toHaveBeenCalled()
    expect(supabase.state.upserts).toEqual([])
    expect(supabase.state.deletes).toEqual([])
    expect(supabase.state.updates).toEqual([])
  })

  it('redirects when the therapist roster source is invalid', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
    })
    createClientMock.mockResolvedValue(supabase)
    parseTherapistRosterSourceMock.mockReturnValue({
      ok: false,
      line: 2,
      message: 'Missing therapist phone number.',
    })

    await expect(replaceTherapistRosterAction(makeReplaceFormData('invalid'))).rejects.toThrow(
      'REDIRECT:/team?error=therapist_roster_invalid&bulk_line=2'
    )

    expect(parseTherapistRosterSourceMock).toHaveBeenCalledWith('invalid')
    expect(supabase.state.upserts).toEqual([])
    expect(supabase.state.deletes).toEqual([])
    expect(supabase.state.updates).toEqual([])
  })

  it('refuses to replace the roster with an empty parsed payload', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
    })
    createClientMock.mockResolvedValue(supabase)
    parseTherapistRosterSourceMock.mockReturnValue({
      ok: true,
      rows: [],
    })

    await expect(replaceTherapistRosterAction(makeReplaceFormData('   '))).rejects.toThrow(
      'REDIRECT:/team?error=therapist_roster_empty'
    )

    expect(supabase.state.upserts).toEqual([])
    expect(supabase.state.deletes).toEqual([])
    expect(supabase.state.updates).toEqual([])
  })

  it('stages the replacement roster before deleting stale rows and archiving therapist or lead profiles', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
      therapistLeadRosterRows: [
        {
          id: 'roster-stale-1',
          full_name: 'Old Therapist',
          normalized_full_name: 'old therapist',
          phone_number: '(903) 111-1111',
          role: 'therapist',
          shift_type: 'day',
          employment_type: 'full_time',
          max_work_days_per_week: 3,
          is_lead_eligible: false,
          is_active: true,
          matched_profile_id: 'profile-stale-1',
          matched_email: 'old@example.com',
          matched_at: '2026-04-01T00:00:00.000Z',
          created_by: 'manager-1',
          updated_by: 'manager-1',
        },
        {
          id: 'roster-keep-1',
          full_name: 'Tannie Brooks',
          normalized_full_name: 'tannie brooks',
          phone_number: '(903) 217-7833',
          role: 'therapist',
          shift_type: 'day',
          employment_type: 'full_time',
          max_work_days_per_week: 3,
          is_lead_eligible: false,
          is_active: true,
          matched_profile_id: 'profile-keep-1',
          matched_email: 'tannie@example.com',
          matched_at: '2026-04-01T00:00:00.000Z',
          created_by: 'manager-1',
          updated_by: 'manager-1',
        },
      ],
      activeTherapistLeadProfiles: [
        { id: 'profile-stale-1', full_name: 'Old Therapist' },
        { id: 'profile-keep-1', full_name: 'Theresa Divergent' },
      ],
      draftCycleRows: [{ id: 'draft-cycle-1' }],
      namedRosterRows: [
        {
          id: 'roster-keep-1',
          normalized_full_name: 'tannie brooks',
          role: 'therapist',
        },
      ],
    })
    createClientMock.mockResolvedValue(supabase)
    parseTherapistRosterSourceMock.mockReturnValue({
      ok: true,
      rows: [
        {
          full_name: 'Tannie Brooks',
          normalized_full_name: 'tannie brooks',
          phone_number: '(903) 217-7833',
          role: 'therapist',
          shift_type: 'day',
          employment_type: 'full_time',
          max_work_days_per_week: 3,
          is_lead_eligible: false,
          is_active: true,
        },
        {
          full_name: 'Jane Smith',
          normalized_full_name: 'jane smith',
          phone_number: '(214) 555-1212',
          role: 'therapist',
          shift_type: 'day',
          employment_type: 'full_time',
          max_work_days_per_week: 3,
          is_lead_eligible: false,
          is_active: true,
        },
      ],
    })

    await expect(replaceTherapistRosterAction(makeReplaceFormData())).rejects.toThrow(
      'REDIRECT:/team?success=therapist_roster_replaced&roster_bulk_count=2'
    )

    expect(supabase.state.upserts).toEqual([
      {
        table: 'employee_roster',
        payload: [
          {
            full_name: 'Tannie Brooks',
            normalized_full_name: 'tannie brooks',
            phone_number: '(903) 217-7833',
            role: 'therapist',
            shift_type: 'day',
            employment_type: 'full_time',
            max_work_days_per_week: 3,
            is_lead_eligible: false,
            is_active: true,
            created_by: 'manager-1',
            updated_by: 'manager-1',
          },
          {
            full_name: 'Jane Smith',
            normalized_full_name: 'jane smith',
            phone_number: '(214) 555-1212',
            role: 'therapist',
            shift_type: 'day',
            employment_type: 'full_time',
            max_work_days_per_week: 3,
            is_lead_eligible: false,
            is_active: true,
            created_by: 'manager-1',
            updated_by: 'manager-1',
          },
        ],
        options: { onConflict: 'normalized_full_name' },
      },
    ])
    expect(supabase.state.deletes).toEqual([
      {
        table: 'employee_roster',
        filters: {
          id: ['roster-stale-1'],
        },
      },
      {
        table: 'shifts',
        filters: {
          user_id: 'profile-stale-1',
          'gte:date': expect.any(String),
          cycle_id: ['draft-cycle-1'],
        },
      },
    ])
    expect(supabase.state.updates).toEqual([
      {
        table: 'profiles',
        payload: {
          archived_at: expect.any(String),
          archived_by: 'manager-1',
          is_active: false,
        },
        filters: {
          id: ['profile-stale-1'],
        },
      },
    ])
    expect(revalidatePathMock).toHaveBeenCalledWith('/team')
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/manager')
    expect(revalidatePathMock).toHaveBeenCalledWith('/availability')
    expect(revalidatePathMock).toHaveBeenCalledWith('/schedule')
    expect(revalidatePathMock).toHaveBeenCalledWith('/coverage')
  })

  it('does not delete stale rows or archive profiles when the staged roster write fails', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
      therapistLeadRosterRows: [
        {
          id: 'roster-stale-1',
          full_name: 'Old Therapist',
          normalized_full_name: 'old therapist',
          phone_number: '(903) 111-1111',
          role: 'therapist',
          shift_type: 'day',
          employment_type: 'full_time',
          max_work_days_per_week: 3,
          is_lead_eligible: false,
          is_active: true,
          matched_profile_id: 'profile-stale-1',
          matched_email: 'old@example.com',
          matched_at: '2026-04-01T00:00:00.000Z',
          created_by: 'manager-1',
          updated_by: 'manager-1',
        },
      ],
      activeTherapistLeadProfiles: [
        { id: 'profile-stale-1', full_name: 'Old Therapist' },
        { id: 'profile-keep-1', full_name: 'Theresa Divergent' },
      ],
      namedRosterRows: [],
      employeeRosterUpsertError: { message: 'write failed' },
    })
    createClientMock.mockResolvedValue(supabase)
    parseTherapistRosterSourceMock.mockReturnValue({
      ok: true,
      rows: [
        {
          full_name: 'Tannie Brooks',
          normalized_full_name: 'tannie brooks',
          phone_number: '(903) 217-7833',
          role: 'therapist',
          shift_type: 'day',
          employment_type: 'full_time',
          max_work_days_per_week: 3,
          is_lead_eligible: false,
          is_active: true,
        },
      ],
    })

    await expect(replaceTherapistRosterAction(makeReplaceFormData())).rejects.toThrow(
      'REDIRECT:/team?error=therapist_roster_replace_failed'
    )

    expect(supabase.state.upserts).toHaveLength(1)
    expect(supabase.state.deletes).toEqual([])
    expect(supabase.state.updates).toEqual([])
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('rolls back the roster snapshot if deleting stale roster rows fails', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
      therapistLeadRosterRows: [
        {
          id: 'roster-stale-1',
          full_name: 'Old Therapist',
          normalized_full_name: 'old therapist',
          phone_number: '(903) 111-1111',
          role: 'therapist',
          shift_type: 'day',
          employment_type: 'full_time',
          max_work_days_per_week: 3,
          is_lead_eligible: false,
          is_active: true,
          matched_profile_id: 'profile-stale-1',
          matched_email: 'old@example.com',
          matched_at: '2026-04-01T00:00:00.000Z',
          created_by: 'manager-1',
          updated_by: 'manager-1',
        },
      ],
      employeeRosterDeleteError: { message: 'delete failed' },
    })
    createClientMock.mockResolvedValue(supabase)
    parseTherapistRosterSourceMock.mockReturnValue({
      ok: true,
      rows: [
        {
          full_name: 'Tannie Brooks',
          normalized_full_name: 'tannie brooks',
          phone_number: '(903) 217-7833',
          role: 'therapist',
          shift_type: 'day',
          employment_type: 'full_time',
          max_work_days_per_week: 3,
          is_lead_eligible: false,
          is_active: true,
        },
      ],
    })

    await expect(replaceTherapistRosterAction(makeReplaceFormData())).rejects.toThrow(
      'REDIRECT:/team?error=therapist_roster_replace_failed'
    )

    expect(supabase.state.upserts).toEqual([
      {
        table: 'employee_roster',
        payload: [
          {
            full_name: 'Tannie Brooks',
            normalized_full_name: 'tannie brooks',
            phone_number: '(903) 217-7833',
            role: 'therapist',
            shift_type: 'day',
            employment_type: 'full_time',
            max_work_days_per_week: 3,
            is_lead_eligible: false,
            is_active: true,
            created_by: 'manager-1',
            updated_by: 'manager-1',
          },
        ],
        options: { onConflict: 'normalized_full_name' },
      },
      {
        table: 'employee_roster',
        payload: [
          {
            id: 'roster-stale-1',
            full_name: 'Old Therapist',
            normalized_full_name: 'old therapist',
            phone_number: '(903) 111-1111',
            role: 'therapist',
            shift_type: 'day',
            employment_type: 'full_time',
            max_work_days_per_week: 3,
            is_lead_eligible: false,
            is_active: true,
            matched_profile_id: 'profile-stale-1',
            matched_email: 'old@example.com',
            matched_at: '2026-04-01T00:00:00.000Z',
            created_by: 'manager-1',
            updated_by: 'manager-1',
          },
        ],
        options: { onConflict: 'normalized_full_name' },
      },
    ])
    expect(supabase.state.deletes).toEqual([
      {
        table: 'employee_roster',
        filters: {
          id: ['roster-stale-1'],
        },
      },
      {
        table: 'employee_roster',
        filters: {
          normalized_full_name: ['tannie brooks'],
          role: ['therapist', 'lead'],
        },
      },
    ])
    expect(supabase.state.updates).toEqual([])
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('rolls back the roster snapshot if archiving stale profiles fails', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
      therapistLeadRosterRows: [
        {
          id: 'roster-stale-1',
          full_name: 'Old Therapist',
          normalized_full_name: 'old therapist',
          phone_number: '(903) 111-1111',
          role: 'therapist',
          shift_type: 'day',
          employment_type: 'full_time',
          max_work_days_per_week: 3,
          is_lead_eligible: false,
          is_active: true,
          matched_profile_id: 'profile-stale-1',
          matched_email: 'old@example.com',
          matched_at: '2026-04-01T00:00:00.000Z',
          created_by: 'manager-1',
          updated_by: 'manager-1',
        },
      ],
      activeTherapistLeadProfiles: [{ id: 'profile-stale-1', full_name: 'Old Therapist' }],
      profileArchiveError: { message: 'archive failed' },
    })
    createClientMock.mockResolvedValue(supabase)
    parseTherapistRosterSourceMock.mockReturnValue({
      ok: true,
      rows: [
        {
          full_name: 'Tannie Brooks',
          normalized_full_name: 'tannie brooks',
          phone_number: '(903) 217-7833',
          role: 'therapist',
          shift_type: 'day',
          employment_type: 'full_time',
          max_work_days_per_week: 3,
          is_lead_eligible: false,
          is_active: true,
        },
      ],
    })

    await expect(replaceTherapistRosterAction(makeReplaceFormData())).rejects.toThrow(
      'REDIRECT:/team?error=therapist_roster_replace_failed'
    )

    expect(supabase.state.upserts).toEqual([
      {
        table: 'employee_roster',
        payload: [
          {
            full_name: 'Tannie Brooks',
            normalized_full_name: 'tannie brooks',
            phone_number: '(903) 217-7833',
            role: 'therapist',
            shift_type: 'day',
            employment_type: 'full_time',
            max_work_days_per_week: 3,
            is_lead_eligible: false,
            is_active: true,
            created_by: 'manager-1',
            updated_by: 'manager-1',
          },
        ],
        options: { onConflict: 'normalized_full_name' },
      },
      {
        table: 'employee_roster',
        payload: [
          {
            id: 'roster-stale-1',
            full_name: 'Old Therapist',
            normalized_full_name: 'old therapist',
            phone_number: '(903) 111-1111',
            role: 'therapist',
            shift_type: 'day',
            employment_type: 'full_time',
            max_work_days_per_week: 3,
            is_lead_eligible: false,
            is_active: true,
            matched_profile_id: 'profile-stale-1',
            matched_email: 'old@example.com',
            matched_at: '2026-04-01T00:00:00.000Z',
            created_by: 'manager-1',
            updated_by: 'manager-1',
          },
        ],
        options: { onConflict: 'normalized_full_name' },
      },
    ])
    expect(supabase.state.deletes).toEqual([
      {
        table: 'employee_roster',
        filters: {
          id: ['roster-stale-1'],
        },
      },
      {
        table: 'employee_roster',
        filters: {
          normalized_full_name: ['tannie brooks'],
          role: ['therapist', 'lead'],
        },
      },
    ])
    expect(supabase.state.updates).toEqual([
      {
        table: 'profiles',
        payload: {
          archived_at: expect.any(String),
          archived_by: 'manager-1',
          is_active: false,
        },
        filters: {
          id: ['profile-stale-1'],
        },
      },
    ])
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})
