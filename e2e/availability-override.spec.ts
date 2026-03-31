import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string; fullName: string }
  fullTimeTherapist: { id: string; fullName: string }
  prnTherapist: { id: string; fullName: string }
  cycle: { id: string; startDate: string; endDate: string }
  targetDate: string
}

test.describe.serial('availability override scheduling', () => {
  test.setTimeout(90_000)
  let ctx: TestContext | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('manager')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const managerFullName = 'E2E Manager'
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: managerFullName,
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const therapistFullName = 'E2E Full Time Therapist'
    const therapist = await createE2EUser(supabase, {
      email: `${randomString('therapist')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
    })

    const prnFullName = 'E2E PRN Therapist'
    const prnTherapist = await createE2EUser(supabase, {
      email: `${randomString('prn')}@example.com`,
      password: `Prn!${Math.random().toString(16).slice(2, 8)}`,
      fullName: prnFullName,
      role: 'therapist',
      employmentType: 'prn',
      shiftType: 'day',
    })

    createdUserIds.push(manager.id, therapist.id, prnTherapist.id)

    const start = new Date()
    start.setDate(start.getDate() - 1)
    const end = new Date()
    end.setDate(end.getDate() + 7)
    const targetDate = formatDateKey(start)

    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: randomString('E2E Cycle'),
        start_date: formatDateKey(start),
        end_date: formatDateKey(end),
        published: false,
      })
      .select('id, start_date, end_date')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(
        `Could not create test cycle: ${cycleInsert.error?.message ?? 'unknown error'}`
      )
    }

    createdCycleIds.push(cycleInsert.data.id)

    const availabilityInsert = await supabase.from('availability_overrides').insert({
      therapist_id: therapist.id,
      cycle_id: cycleInsert.data.id,
      date: targetDate,
      shift_type: 'both',
      override_type: 'force_off',
      note: 'Vacation',
      created_by: therapist.id,
    })

    if (availabilityInsert.error) {
      throw new Error(`Could not seed availability entry: ${availabilityInsert.error.message}`)
    }

    ctx = {
      supabase,
      manager: {
        id: manager.id,
        email: managerEmail,
        password: managerPassword,
        fullName: managerFullName,
      },
      fullTimeTherapist: { id: therapist.id, fullName: therapistFullName },
      prnTherapist: { id: prnTherapist.id, fullName: prnFullName },
      cycle: {
        id: cycleInsert.data.id,
        startDate: cycleInsert.data.start_date,
        endDate: cycleInsert.data.end_date,
      },
      targetDate,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    for (const cycleId of createdCycleIds) {
      await ctx.supabase.from('shifts').delete().eq('cycle_id', cycleId)
      await ctx.supabase.from('availability_overrides').delete().eq('cycle_id', cycleId)
      await ctx.supabase.from('schedule_cycles').delete().eq('id', cycleId)
    }

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
  })

  test('unavailable assignment shows warning modal; cancel prevents assignment; confirm writes override', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await page.getByTestId(`coverage-day-cell-button-${ctx!.targetDate}`).click()
    const shiftDialog = page.getByTestId('coverage-shift-editor-dialog')
    await expect(shiftDialog).toBeVisible()

    const conflictResponse = await page.evaluate(
      async (payload) => {
        const response = await fetch('/api/schedule/drag-drop', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const body = await response.json().catch(() => null)
        return { status: response.status, body }
      },
      {
        action: 'assign',
        cycleId: ctx!.cycle.id,
        userId: ctx!.fullTimeTherapist.id,
        date: ctx!.targetDate,
        shiftType: 'day',
        role: 'staff',
        overrideWeeklyRules: false,
      }
    )
    expect(conflictResponse.status).toBe(409)
    const conflictPayload = conflictResponse.body as { code?: string } | null
    expect(conflictPayload?.code).toBe('availability_conflict')

    const noShiftResult = await ctx!.supabase
      .from('shifts')
      .select('id')
      .eq('cycle_id', ctx!.cycle.id)
      .eq('user_id', ctx!.fullTimeTherapist.id)
      .eq('date', ctx!.targetDate)
      .eq('shift_type', 'day')
    expect(noShiftResult.error).toBeNull()
    expect(noShiftResult.data ?? []).toHaveLength(0)

    const overrideResponse = await page.evaluate(
      async (payload) => {
        const response = await fetch('/api/schedule/drag-drop', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const body = await response.json().catch(() => null)
        return { status: response.status, body }
      },
      {
        action: 'assign',
        cycleId: ctx!.cycle.id,
        userId: ctx!.fullTimeTherapist.id,
        date: ctx!.targetDate,
        shiftType: 'day',
        role: 'staff',
        overrideWeeklyRules: false,
        availabilityOverride: true,
        availabilityOverrideReason: 'Coverage emergency',
      }
    )
    expect(overrideResponse.status).toBe(200)
    const overridePayload = overrideResponse.body as { message?: string } | null
    expect(overridePayload?.message).toBe('Shift assigned.')

    const assignedShiftResult = await ctx!.supabase
      .from('shifts')
      .select(
        'availability_override, availability_override_reason, availability_override_by, availability_override_at'
      )
      .eq('cycle_id', ctx!.cycle.id)
      .eq('user_id', ctx!.fullTimeTherapist.id)
      .eq('date', ctx!.targetDate)
      .eq('shift_type', 'day')
      .single()

    expect(assignedShiftResult.error).toBeNull()
    expect(assignedShiftResult.data?.availability_override).toBe(true)
    expect(assignedShiftResult.data?.availability_override_reason).toBe('Coverage emergency')
    expect(assignedShiftResult.data?.availability_override_by).toBe(ctx!.manager.id)
    expect(assignedShiftResult.data?.availability_override_at).toBeTruthy()
  })

  test('PRN not offered therapist is disabled in the staffing picker', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await page.getByTestId(`coverage-day-cell-button-${ctx!.targetDate}`).click()
    const shiftDialog = page.getByTestId('coverage-shift-editor-dialog')
    await expect(shiftDialog).toBeVisible()

    const prnOption = page.getByTestId(`coverage-assign-toggle-${ctx!.prnTherapist.id}-staff`)
    await expect(prnOption).toBeVisible()
    await prnOption.click()
    await expect(page.getByTestId('coverage-assign-error')).toBeVisible()

    const assignedShiftResult = await ctx!.supabase
      .from('shifts')
      .select('id')
      .eq('cycle_id', ctx!.cycle.id)
      .eq('user_id', ctx!.prnTherapist.id)
      .eq('date', ctx!.targetDate)
      .eq('shift_type', 'day')

    expect(assignedShiftResult.error).toBeNull()
    expect(assignedShiftResult.data ?? []).toHaveLength(0)
  })
})
