import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, revalidatePathMock, createClientMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  revalidatePathMock: vi.fn(),
  createClientMock: vi.fn(),
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

import {
  applyEmailAvailabilityImportAction,
  copyAvailabilityFromPreviousCycleAction,
  createManualEmailIntakeAction,
  deleteAvailabilityEntryAction,
  deleteManagerPlannerDateAction,
  saveManagerPlannerDatesAction,
  submitAvailabilityEntryAction,
  submitTherapistAvailabilityGridAction,
} from '@/app/availability/actions'

type TestContext = {
  userId?: string | null
  role?: string | null
  therapistSubmissionExists?: boolean
}

function createSupabaseMock(context: TestContext = {}) {
  const state = {
    upsertPayloads: [] as Array<Record<string, unknown> | Array<Record<string, unknown>>>,
    inserts: [] as Array<{
      table: string
      payload: Record<string, unknown> | Array<Record<string, unknown>>
    }>,
    updates: [] as Array<{
      table: string
      payload: Record<string, unknown>
      filters: Record<string, unknown>
    }>,
    deletes: [] as Array<{ table: string; filters: Record<string, unknown> }>,
    selectRows: [] as Array<Record<string, unknown>>,
    sourceCycleRows: null as Array<Record<string, unknown>> | null,
    sourceOverrideRows: null as Array<Record<string, unknown>> | null,
    existingTargetRows: null as Array<Record<string, unknown>> | null,
    emailIntakeRow: null as Record<string, unknown> | null,
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
        neq(column: string, value: unknown) {
          filters.set(`neq:${column}`, value)
          return builder
        },
        order(column: string, options?: unknown) {
          filters.set(`order:${column}`, options ?? true)
          return builder
        },
        limit(count: number) {
          filters.set('limit', count)
          return builder
        },
        in(column: string, values: unknown[]) {
          filters.set(column, values)
          return builder
        },
        delete() {
          return {
            eq(column: string, value: unknown) {
              filters.set(column, value)
              return this
            },
            in(column: string, values: unknown[]) {
              filters.set(column, values)
              return this
            },
            then(resolve: (value: unknown) => unknown) {
              state.deletes.push({
                table,
                filters: Object.fromEntries(filters.entries()),
              })
              return Promise.resolve(resolve({ error: null }))
            },
          }
        },
        upsert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
          state.upsertPayloads.push(payload)
          return Promise.resolve({ error: null })
        },
        insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
          state.inserts.push({ table, payload })
          return Promise.resolve({ error: null })
        },
        update(payload: Record<string, unknown>) {
          const commitUpdate = () => {
            state.updates.push({
              table,
              payload,
              filters: Object.fromEntries(filters.entries()),
            })
            return Promise.resolve({ error: null })
          }

          return {
            eq(column: string, value: unknown) {
              filters.set(column, value)
              return {
                eq(column2: string, value2: unknown) {
                  filters.set(column2, value2)
                  return commitUpdate()
                },
                then(resolve: (value: unknown) => unknown) {
                  return commitUpdate().then(resolve)
                },
              }
            },
          }
        },
        maybeSingle: async () => {
          if (table === 'profiles' && selected === 'role') {
            return { data: { role: context.role }, error: null }
          }
          if (table === 'schedule_cycles') {
            return {
              data: {
                id: 'cycle-1',
                label: 'Block 1',
                start_date: '2026-03-22',
                end_date: '2026-05-02',
              },
              error: null,
            }
          }
          if (table === 'therapist_availability_submissions' && selected.includes('submitted_at')) {
            return {
              data: context.therapistSubmissionExists
                ? { submitted_at: '2026-04-01T12:00:00.000Z' }
                : null,
              error: null,
            }
          }
          if (table === 'therapist_availability_submissions' && selected.includes('id')) {
            return {
              data: context.therapistSubmissionExists ? { id: 'sub-1' } : null,
              error: null,
            }
          }
          if (table === 'availability_email_intakes') {
            return {
              data: state.emailIntakeRow,
              error: null,
            }
          }
          return { data: null, error: null }
        },
        then(resolve: (value: unknown) => unknown) {
          if (table === 'availability_overrides' && selected.includes('id, date')) {
            return Promise.resolve(
              resolve({
                data: state.selectRows,
                error: null,
              })
            )
          }
          if (table === 'availability_overrides' && selected.includes('cycle_id')) {
            return Promise.resolve(
              resolve({
                data: state.sourceCycleRows ?? null,
                error: null,
              })
            )
          }
          if (table === 'availability_overrides' && selected.includes('date, override_type')) {
            return Promise.resolve(
              resolve({
                data: state.sourceOverrideRows ?? null,
                error: null,
              })
            )
          }
          if (
            table === 'availability_overrides' &&
            selected.includes('date') &&
            !selected.includes('override_type')
          ) {
            return Promise.resolve(
              resolve({
                data: state.existingTargetRows ?? null,
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

function makeTherapistFormData() {
  const formData = new FormData()
  formData.set('date', '2026-03-24')
  formData.set('cycle_id', 'cycle-1')
  formData.set('shift_type', 'both')
  formData.set('override_type', 'force_off')
  formData.set('note', 'doctor visit')
  return formData
}

function makeManagerPlannerFormData() {
  const formData = new FormData()
  formData.set('cycle_id', 'cycle-1')
  formData.set('therapist_id', 'therapist-1')
  formData.set('shift_type', 'day')
  formData.set('mode', 'will_work')
  formData.append('dates', '2026-03-24')
  formData.append('dates', '2026-03-26')
  return formData
}

function makeTherapistGridFormData() {
  const formData = new FormData()
  formData.set('cycle_id', 'cycle-1')
  formData.append('can_work_dates', '2026-03-24')
  formData.append('cannot_work_dates', '2026-03-26')
  formData.set(
    'notes_json',
    JSON.stringify({
      '2026-03-24': 'Please schedule if census is high',
      '2026-03-26': 'Family appointment',
    })
  )
  return formData
}

describe('availability actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets a therapist save their own availability request', async () => {
    const supabase = createSupabaseMock({ userId: 'therapist-1', role: 'therapist' })
    createClientMock.mockResolvedValue(supabase)

    await expect(submitAvailabilityEntryAction(makeTherapistFormData())).rejects.toThrow(
      'REDIRECT:/availability?success=entry_submitted&cycle=cycle-1'
    )

    expect(supabase.state.upsertPayloads[0]).toEqual({
      therapist_id: 'therapist-1',
      cycle_id: 'cycle-1',
      date: '2026-03-24',
      shift_type: 'both',
      override_type: 'force_off',
      note: 'doctor visit',
      created_by: 'therapist-1',
      source: 'therapist',
    })
    expect(
      supabase.state.inserts.some((row) => row.table === 'therapist_availability_submissions')
    ).toBe(true)
    expect(revalidatePathMock).toHaveBeenCalledWith('/availability')
    expect(revalidatePathMock).toHaveBeenCalledWith('/therapist/availability')
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/staff')
  })

  it('only lets a therapist delete their own availability row', async () => {
    const supabase = createSupabaseMock({ userId: 'therapist-1', role: 'therapist' })
    createClientMock.mockResolvedValue(supabase)
    const formData = new FormData()
    formData.set('entry_id', 'override-1')
    formData.set('cycle_id', 'cycle-1')

    await expect(deleteAvailabilityEntryAction(formData)).rejects.toThrow(
      'REDIRECT:/availability?success=entry_deleted&cycle=cycle-1'
    )

    expect(supabase.state.deletes).toEqual([
      {
        table: 'availability_overrides',
        filters: {
          id: 'override-1',
          therapist_id: 'therapist-1',
        },
      },
    ])
  })

  it('lets a manager replace planner dates for one therapist and mode', async () => {
    const supabase = createSupabaseMock({ userId: 'manager-1', role: 'manager' })
    supabase.state.selectRows = [
      {
        id: 'override-old-1',
        date: '2026-03-22',
      },
      {
        id: 'override-keep-1',
        date: '2026-03-24',
      },
    ]
    createClientMock.mockResolvedValue(supabase)

    await expect(saveManagerPlannerDatesAction(makeManagerPlannerFormData())).rejects.toThrow(
      'REDIRECT:/availability?cycle=cycle-1&therapist=therapist-1&success=planner_saved'
    )

    expect(supabase.state.deletes).toEqual([
      {
        table: 'availability_overrides',
        filters: {
          id: ['override-old-1'],
        },
      },
    ])
    expect(supabase.state.upsertPayloads[0]).toEqual([
      {
        cycle_id: 'cycle-1',
        therapist_id: 'therapist-1',
        date: '2026-03-24',
        shift_type: 'day',
        override_type: 'force_on',
        note: null,
        created_by: 'manager-1',
        source: 'manager',
      },
      {
        cycle_id: 'cycle-1',
        therapist_id: 'therapist-1',
        date: '2026-03-26',
        shift_type: 'day',
        override_type: 'force_on',
        note: null,
        created_by: 'manager-1',
        source: 'manager',
      },
    ])
  })

  it('lets a therapist save full-cycle availability with day-level notes', async () => {
    const supabase = createSupabaseMock({ userId: 'therapist-1', role: 'therapist' })
    createClientMock.mockResolvedValue(supabase)

    await expect(
      submitTherapistAvailabilityGridAction(makeTherapistGridFormData())
    ).rejects.toThrow('REDIRECT:/availability?success=entry_submitted&cycle=cycle-1')

    expect(supabase.state.upsertPayloads[0]).toEqual([
      {
        therapist_id: 'therapist-1',
        cycle_id: 'cycle-1',
        date: '2026-03-24',
        shift_type: 'both',
        override_type: 'force_on',
        note: 'Please schedule if census is high',
        created_by: 'therapist-1',
        source: 'therapist',
      },
      {
        therapist_id: 'therapist-1',
        cycle_id: 'cycle-1',
        date: '2026-03-26',
        shift_type: 'both',
        override_type: 'force_off',
        note: 'Family appointment',
        created_by: 'therapist-1',
        source: 'therapist',
      },
    ])
    expect(supabase.state.inserts).toHaveLength(1)
    expect(supabase.state.inserts[0].table).toBe('therapist_availability_submissions')
    expect(supabase.state.inserts[0].payload.therapist_id).toBe('therapist-1')
    expect(supabase.state.inserts[0].payload.schedule_cycle_id).toBe('cycle-1')
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/staff')
  })

  it('saves grid draft without creating a submission record', async () => {
    const supabase = createSupabaseMock({ userId: 'therapist-1', role: 'therapist' })
    createClientMock.mockResolvedValue(supabase)
    const formData = makeTherapistGridFormData()
    formData.set('workflow', 'draft')

    await expect(submitTherapistAvailabilityGridAction(formData)).rejects.toThrow(
      'REDIRECT:/availability?success=draft_saved&cycle=cycle-1'
    )

    expect(supabase.state.inserts).toHaveLength(0)
    expect(supabase.state.updates).toHaveLength(0)
  })

  it('updates last_edited_at when resubmitting an existing official submission', async () => {
    const supabase = createSupabaseMock({
      userId: 'therapist-1',
      role: 'therapist',
      therapistSubmissionExists: true,
    })
    createClientMock.mockResolvedValue(supabase)

    await expect(
      submitTherapistAvailabilityGridAction(makeTherapistGridFormData())
    ).rejects.toThrow('REDIRECT:/availability?success=entry_submitted&cycle=cycle-1')

    expect(supabase.state.inserts).toHaveLength(0)
    expect(supabase.state.updates).toEqual([
      {
        table: 'therapist_availability_submissions',
        payload: expect.objectContaining({ last_edited_at: expect.any(String) }),
        filters: { therapist_id: 'therapist-1', schedule_cycle_id: 'cycle-1' },
      },
    ])
  })

  it('lets a manager delete a manager-entered planner row', async () => {
    const supabase = createSupabaseMock({ userId: 'manager-1', role: 'manager' })
    createClientMock.mockResolvedValue(supabase)
    const formData = new FormData()
    formData.set('override_id', 'override-1')
    formData.set('cycle_id', 'cycle-1')
    formData.set('therapist_id', 'therapist-1')

    await expect(deleteManagerPlannerDateAction(formData)).rejects.toThrow(
      'REDIRECT:/availability?cycle=cycle-1&therapist=therapist-1&success=planner_deleted'
    )

    expect(supabase.state.deletes).toEqual([
      {
        table: 'availability_overrides',
        filters: {
          id: 'override-1',
          source: 'manager',
        },
      },
    ])
  })

  it('applies parsed inbound email requests into manager availability', async () => {
    const supabase = createSupabaseMock({ userId: 'manager-1', role: 'manager' })
    supabase.state.emailIntakeRow = {
      id: 'intake-1',
      matched_therapist_id: 'therapist-1',
      matched_cycle_id: 'cycle-1',
      parse_status: 'parsed',
      parsed_requests: [
        {
          date: '2026-03-24',
          override_type: 'force_off',
          shift_type: 'both',
          note: null,
          source_line: 'Off Mar 24',
        },
        {
          date: '2026-03-26',
          override_type: 'force_on',
          shift_type: 'both',
          note: null,
          source_line: 'Work Mar 26',
        },
      ],
    }
    createClientMock.mockResolvedValue(supabase)
    const formData = new FormData()
    formData.set('intake_id', 'intake-1')

    await expect(applyEmailAvailabilityImportAction(formData)).rejects.toThrow(
      'REDIRECT:/availability?success=email_intake_applied'
    )

    expect(supabase.state.upsertPayloads[0]).toEqual([
      {
        cycle_id: 'cycle-1',
        therapist_id: 'therapist-1',
        date: '2026-03-24',
        shift_type: 'both',
        override_type: 'force_off',
        note: 'Imported from email: Off Mar 24',
        created_by: 'manager-1',
        source: 'manager',
      },
      {
        cycle_id: 'cycle-1',
        therapist_id: 'therapist-1',
        date: '2026-03-26',
        shift_type: 'both',
        override_type: 'force_on',
        note: 'Imported from email: Work Mar 26',
        created_by: 'manager-1',
        source: 'manager',
      },
    ])
    expect(supabase.state.updates).toEqual([
      {
        table: 'availability_email_intakes',
        payload: expect.objectContaining({
          parse_status: 'applied',
          applied_by: 'manager-1',
          applied_at: expect.any(String),
        }),
        filters: { id: 'intake-1' },
      },
    ])
  })

  it('creates a manual intake from pasted text for a selected therapist and cycle', async () => {
    const supabase = createSupabaseMock({ userId: 'manager-1', role: 'manager' })
    createClientMock.mockResolvedValue(supabase)
    const formData = new FormData()
    formData.set('therapist_id', 'therapist-1')
    formData.set('cycle_id', 'cycle-1')
    formData.set('subject', 'Uploaded request form')
    formData.set('source_email', 'employee@example.com')
    formData.set('pasted_text', 'Need off Mar 24, Mar 26')

    await expect(createManualEmailIntakeAction(formData)).rejects.toThrow(
      'REDIRECT:/availability?success=email_intake_created'
    )

    expect(supabase.state.inserts).toHaveLength(1)
    expect(supabase.state.inserts[0]?.table).toBe('availability_email_intakes')
    expect(supabase.state.inserts[0]?.payload).toEqual(
      expect.objectContaining({
        provider: 'manual',
        provider_email_id: expect.stringMatching(/^manual-/),
        from_email: 'employee@example.com',
        subject: 'Uploaded request form',
        matched_therapist_id: 'therapist-1',
        matched_cycle_id: 'cycle-1',
        parse_status: 'parsed',
        parsed_requests: [
          {
            date: '2026-03-24',
            override_type: 'force_off',
            shift_type: 'both',
            note: null,
            source_line: 'Need off Mar 24, Mar 26',
          },
          {
            date: '2026-03-26',
            override_type: 'force_off',
            shift_type: 'both',
            note: null,
            source_line: 'Need off Mar 24, Mar 26',
          },
        ],
      })
    )
  })
})

describe('copyAvailabilityFromPreviousCycleAction', () => {
  function makeCopyFormData() {
    const formData = new FormData()
    formData.set('cycle_id', 'cycle-new')
    formData.set('therapist_id', 'therapist-1')
    return formData
  }

  it('redirects to /availability when called by a non-manager', async () => {
    const mock = createSupabaseMock({ userId: 'therapist-1', role: 'therapist' })
    createClientMock.mockResolvedValue(mock)

    await expect(copyAvailabilityFromPreviousCycleAction(makeCopyFormData())).rejects.toThrow(
      'REDIRECT:/availability'
    )
  })

  it('redirects with copy_no_source when no previous cycle has overrides', async () => {
    const mock = createSupabaseMock({ userId: 'mgr-1', role: 'manager' })
    mock.state.sourceCycleRows = null
    createClientMock.mockResolvedValue(mock)

    await expect(copyAvailabilityFromPreviousCycleAction(makeCopyFormData())).rejects.toThrow(
      'REDIRECT:/availability?error=copy_no_source&cycle=cycle-new&therapist=therapist-1'
    )
  })

  it('redirects with copy_no_source when source cycle has no overrides', async () => {
    const mock = createSupabaseMock({ userId: 'mgr-1', role: 'manager' })
    mock.state.sourceCycleRows = [
      {
        cycle_id: 'cycle-old',
        schedule_cycles: { start_date: '2026-02-08', end_date: '2026-03-21' },
      },
    ]
    mock.state.sourceOverrideRows = []
    createClientMock.mockResolvedValue(mock)

    await expect(copyAvailabilityFromPreviousCycleAction(makeCopyFormData())).rejects.toThrow(
      'REDIRECT:/availability?error=copy_no_source&cycle=cycle-new&therapist=therapist-1'
    )
  })

  it('upserts shifted overrides and redirects with copy_success', async () => {
    const mock = createSupabaseMock({ userId: 'mgr-1', role: 'manager' })
    mock.state.sourceCycleRows = [
      {
        cycle_id: 'cycle-old',
        schedule_cycles: { start_date: '2026-02-08', end_date: '2026-03-21' },
      },
    ]
    mock.state.sourceOverrideRows = [
      { date: '2026-02-11', override_type: 'force_on', shift_type: 'both', note: null },
      { date: '2026-02-13', override_type: 'force_off', shift_type: 'both', note: 'event' },
    ]
    mock.state.existingTargetRows = []
    createClientMock.mockResolvedValue(mock)

    await expect(copyAvailabilityFromPreviousCycleAction(makeCopyFormData())).rejects.toThrow(
      'REDIRECT:/availability?cycle=cycle-new&therapist=therapist-1&success=copy_success&copied=2'
    )

    expect(mock.state.upsertPayloads).toHaveLength(1)
    const payload = mock.state.upsertPayloads[0] as Array<Record<string, unknown>>
    expect(payload).toHaveLength(2)
    expect(payload[0].date).toBe('2026-03-25')
    expect(payload[1].date).toBe('2026-03-27')
  })

  it('redirects with copy_nothing_new when all shifted dates already exist in target', async () => {
    const mock = createSupabaseMock({ userId: 'mgr-1', role: 'manager' })
    mock.state.sourceCycleRows = [
      {
        cycle_id: 'cycle-old',
        schedule_cycles: { start_date: '2026-02-08', end_date: '2026-03-21' },
      },
    ]
    mock.state.sourceOverrideRows = [
      { date: '2026-02-11', override_type: 'force_on', shift_type: 'both', note: null },
    ]
    mock.state.existingTargetRows = [{ date: '2026-03-25' }]
    createClientMock.mockResolvedValue(mock)

    await expect(copyAvailabilityFromPreviousCycleAction(makeCopyFormData())).rejects.toThrow(
      'REDIRECT:/availability?cycle=cycle-new&therapist=therapist-1&error=copy_nothing_new'
    )
  })
})
