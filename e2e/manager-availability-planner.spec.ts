import { expect, test, type Locator } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  leadTherapist: { id: string }
  therapist: { id: string; fullName: string }
  prnTherapist: { id: string; fullName: string }
  cycle: { id: string; startDate: string; endDate: string }
  therapistWillWorkDate: string
  therapistCannotWorkDate: string
  prnWillWorkDate: string
}

function formatCalendarLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

async function createCycle(supabase: SupabaseClient) {
  const startDate = addDays(new Date(), -1)
  const endDate = addDays(startDate, 13)
  const label = `Planner E2E ${randomString('cycle')}`
  const { data, error } = await supabase
    .from('schedule_cycles')
    .insert({
      label,
      start_date: formatDateKey(startDate),
      end_date: formatDateKey(endDate),
      published: false,
    })
    .select('id, start_date, end_date')
    .single()

  if (error || !data) {
    throw new Error(`Could not create test cycle: ${error?.message ?? 'unknown error'}`)
  }

  return {
    id: data.id,
    startDate: data.start_date,
    endDate: data.end_date,
  }
}

test.describe.serial('/availability manager planner', () => {
  test.setTimeout(90_000)
  let ctx: TestContext | null = null
  const createdUserIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('planner-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'E2E Planner Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const leadTherapist = await createE2EUser(supabase, {
      email: `${randomString('planner-lead')}@example.com`,
      password: `Lead!${Math.random().toString(16).slice(2, 8)}`,
      fullName: 'E2E Lead Therapist',
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const therapistFullName = `E2E Planner Therapist ${randomString('ther')}`
    const therapist = await createE2EUser(supabase, {
      email: `${randomString('planner-ther')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    const prnFullName = `E2E Planner PRN ${randomString('prn')}`
    const prnTherapist = await createE2EUser(supabase, {
      email: `${randomString('planner-prn')}@example.com`,
      password: `Prn!${Math.random().toString(16).slice(2, 8)}`,
      fullName: prnFullName,
      role: 'therapist',
      employmentType: 'prn',
      shiftType: 'day',
      isLeadEligible: false,
    })

    const cycle = await createCycle(supabase)
    const cycleStartDate = new Date(`${cycle.startDate}T00:00:00`)
    const therapistWillWorkDate = formatDateKey(addDays(cycleStartDate, 2))
    const therapistCannotWorkDate = formatDateKey(addDays(cycleStartDate, 4))
    const prnWillWorkDate = formatDateKey(addDays(cycleStartDate, 3))

    createdUserIds.push(manager.id, leadTherapist.id, therapist.id, prnTherapist.id)
    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      leadTherapist,
      therapist: { id: therapist.id, fullName: therapistFullName },
      prnTherapist: { id: prnTherapist.id, fullName: prnFullName },
      cycle,
      therapistWillWorkDate,
      therapistCannotWorkDate,
      prnWillWorkDate,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return
    await ctx.supabase.from('availability_overrides').delete().eq('cycle_id', ctx.cycle.id)
    await ctx.supabase.from('shifts').delete().eq('cycle_id', ctx.cycle.id)
    await ctx.supabase.from('schedule_cycles').delete().eq('id', ctx.cycle.id)
    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
  })

  test('manager can save hard dates and auto-draft honors them', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/availability?cycle=${ctx!.cycle.id}&therapist=${ctx!.therapist.id}`, {
      waitUntil: 'domcontentloaded',
    })

    const planner = page.locator('#staff-scheduling-inputs')
    await expect(page.getByRole('heading', { name: 'Plan staffing' }).first()).toBeVisible({
      timeout: 20_000,
    })
    const calendarDay = (root: Locator, isoDate: string) =>
      root.getByRole('button', { name: formatCalendarLabel(isoDate) })

    await planner.getByLabel('Therapist').selectOption(ctx!.therapist.id)
    await calendarDay(planner, ctx!.therapistWillWorkDate).click()
    await calendarDay(planner, ctx!.therapistCannotWorkDate).click()
    await planner.getByRole('button', { name: 'Save Will work' }).click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('availability_overrides')
            .select('date')
            .eq('cycle_id', ctx!.cycle.id)
            .eq('therapist_id', ctx!.therapist.id)
            .eq('override_type', 'force_on')
          if (result.error) throw new Error(result.error.message)
          return (result.data ?? [])
            .map((row) => row.date)
            .sort()
            .join(',')
        },
        { timeout: 20_000 }
      )
      .toBe([ctx!.therapistWillWorkDate, ctx!.therapistCannotWorkDate].sort().join(','))

    await page.goto(`/availability?cycle=${ctx!.cycle.id}&therapist=${ctx!.therapist.id}`)
    const refreshedPlanner = page.locator('#staff-scheduling-inputs')
    await refreshedPlanner.getByRole('button', { name: /^Cannot work$/ }).click()
    await expect(refreshedPlanner.getByRole('button', { name: 'Save Cannot work' })).toBeVisible()
    await calendarDay(refreshedPlanner, ctx!.therapistCannotWorkDate).click()
    await refreshedPlanner.getByRole('button', { name: 'Save Cannot work' }).click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('availability_overrides')
            .select('id')
            .eq('cycle_id', ctx!.cycle.id)
            .eq('therapist_id', ctx!.therapist.id)
            .eq('date', ctx!.therapistCannotWorkDate)
            .eq('override_type', 'force_off')
          if (result.error) throw new Error(result.error.message)
          return result.data?.length ?? 0
        },
        { timeout: 20_000 }
      )
      .toBe(1)

    await page.goto(`/availability?cycle=${ctx!.cycle.id}&therapist=${ctx!.prnTherapist.id}`)
    const prnPlanner = page.locator('#staff-scheduling-inputs')
    await prnPlanner.getByLabel('Therapist').selectOption(ctx!.prnTherapist.id)
    await calendarDay(prnPlanner, ctx!.prnWillWorkDate).click()
    await prnPlanner.getByRole('button', { name: 'Save Will work' }).click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('availability_overrides')
            .select('id')
            .eq('cycle_id', ctx!.cycle.id)
            .eq('therapist_id', ctx!.prnTherapist.id)
            .eq('date', ctx!.prnWillWorkDate)
            .eq('override_type', 'force_on')
          if (result.error) throw new Error(result.error.message)
          return result.data?.length ?? 0
        },
        { timeout: 20_000 }
      )
      .toBe(1)

    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)
    await page.getByRole('button', { name: 'Auto-draft' }).first().click()
    await page.getByRole('button', { name: 'Apply Draft' }).click()

    await expect
      .poll(
        async () => {
          const shiftsResult = await ctx!.supabase
            .from('shifts')
            .select('user_id, date, shift_type')
            .eq('cycle_id', ctx!.cycle.id)
            .in('user_id', [ctx!.leadTherapist.id, ctx!.therapist.id, ctx!.prnTherapist.id])
          if (shiftsResult.error) throw new Error(shiftsResult.error.message)
          return (shiftsResult.data ?? []).some(
            (row) => row.user_id === ctx!.prnTherapist.id && row.date === ctx!.prnWillWorkDate
          )
        },
        { timeout: 30_000 }
      )
      .toBe(true)

    const shiftsResult = await ctx!.supabase
      .from('shifts')
      .select('user_id, date, shift_type')
      .eq('cycle_id', ctx!.cycle.id)
      .in('user_id', [ctx!.leadTherapist.id, ctx!.therapist.id, ctx!.prnTherapist.id])

    expect(shiftsResult.error).toBeNull()
    const shifts = shiftsResult.data ?? []

    expect(
      shifts.some(
        (row) => row.user_id === ctx!.therapist.id && row.date === ctx!.therapistCannotWorkDate
      )
    ).toBe(false)
    expect(
      shifts.some(
        (row) => row.user_id === ctx!.prnTherapist.id && row.date === ctx!.prnWillWorkDate
      )
    ).toBe(true)
  })
})
