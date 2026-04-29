import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type ManagerScheduleCtx = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  draftCycle: { id: string; label: string; shortLabel: string }
  liveCycle: { id: string; label: string; shortLabel: string }
  dayCore: { id: string; name: string }
  dayPrn: { id: string; name: string }
  nightCore: { id: string; name: string }
}

function formatShortCycleLabel(start: Date, end: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return `${formatter.format(start)} – ${formatter.format(end)}, ${start.getUTCFullYear()}`
}

test.describe.serial('manager schedule roster route', () => {
  test.setTimeout(120_000)

  let ctx: ManagerScheduleCtx | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('sched-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 10)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: `Schedule Manager ${randomString('mgr')}`,
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(manager.id)

    const dayCoreName = `Roster Day Core ${randomString('daycore')}`
    const dayCore = await createE2EUser(supabase, {
      email: `${randomString('daycore')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 10)}`,
      fullName: dayCoreName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(dayCore.id)

    const dayPrnName = `Roster Day PRN ${randomString('dayprn')}`
    const dayPrn = await createE2EUser(supabase, {
      email: `${randomString('dayprn')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 10)}`,
      fullName: dayPrnName,
      role: 'therapist',
      employmentType: 'prn',
      shiftType: 'day',
      isLeadEligible: false,
      maxWorkDaysPerWeek: 1,
    })
    createdUserIds.push(dayPrn.id)

    const nightCoreName = `Roster Night Core ${randomString('nightcore')}`
    const nightCore = await createE2EUser(supabase, {
      email: `${randomString('nightcore')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 10)}`,
      fullName: nightCoreName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'night',
      isLeadEligible: false,
    })
    createdUserIds.push(nightCore.id)

    const draftStart = addDays(new Date(), 3)
    const draftEnd = addDays(draftStart, 13)
    const liveStart = addDays(draftStart, 14)
    const liveEnd = addDays(liveStart, 13)

    const draftLabel = `Roster Draft ${randomString('draft')}`
    const liveLabel = `Roster Live ${randomString('live')}`
    const draftInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: draftLabel,
        start_date: formatDateKey(draftStart),
        end_date: formatDateKey(draftEnd),
        published: false,
      })
      .select('id')
      .single()
    if (draftInsert.error || !draftInsert.data) {
      throw new Error(draftInsert.error?.message ?? 'Could not create draft cycle.')
    }

    const liveInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: liveLabel,
        start_date: formatDateKey(liveStart),
        end_date: formatDateKey(liveEnd),
        published: true,
      })
      .select('id')
      .single()
    if (liveInsert.error || !liveInsert.data) {
      throw new Error(liveInsert.error?.message ?? 'Could not create live cycle.')
    }

    createdCycleIds.push(draftInsert.data.id, liveInsert.data.id)

    const draftDay1 = formatDateKey(draftStart)
    const draftDay2 = formatDateKey(addDays(draftStart, 1))
    const draftDay3 = formatDateKey(addDays(draftStart, 2))
    const liveDay1 = formatDateKey(liveStart)
    const liveDay2 = formatDateKey(addDays(liveStart, 1))

    const submissionInsert = await supabase.from('therapist_availability_submissions').insert([
      {
        therapist_id: dayCore.id,
        schedule_cycle_id: draftInsert.data.id,
        submitted_at: new Date().toISOString(),
        last_edited_at: new Date().toISOString(),
      },
      {
        therapist_id: dayPrn.id,
        schedule_cycle_id: draftInsert.data.id,
        submitted_at: new Date().toISOString(),
        last_edited_at: new Date().toISOString(),
      },
      {
        therapist_id: nightCore.id,
        schedule_cycle_id: draftInsert.data.id,
        submitted_at: new Date().toISOString(),
        last_edited_at: new Date().toISOString(),
      },
    ])
    if (submissionInsert.error) {
      throw new Error(`Could not seed submissions: ${submissionInsert.error.message}`)
    }

    const overrideInsert = await supabase.from('availability_overrides').insert([
      {
        therapist_id: dayCore.id,
        cycle_id: draftInsert.data.id,
        date: draftDay2,
        shift_type: 'day',
        override_type: 'force_off',
        note: 'manager-schedule off',
        created_by: dayCore.id,
        source: 'therapist',
      },
      {
        therapist_id: dayPrn.id,
        cycle_id: draftInsert.data.id,
        date: draftDay1,
        shift_type: 'day',
        override_type: 'force_on',
        note: 'manager-schedule work',
        created_by: dayPrn.id,
        source: 'therapist',
      },
      {
        therapist_id: nightCore.id,
        cycle_id: draftInsert.data.id,
        date: draftDay3,
        shift_type: 'night',
        override_type: 'force_off',
        note: 'manager-schedule night off',
        created_by: nightCore.id,
        source: 'therapist',
      },
    ])
    if (overrideInsert.error) {
      throw new Error(`Could not seed overrides: ${overrideInsert.error.message}`)
    }

    const shiftsInsert = await supabase.from('shifts').insert([
      {
        cycle_id: draftInsert.data.id,
        user_id: dayCore.id,
        date: draftDay1,
        shift_type: 'day',
        site_id: 'default',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: draftInsert.data.id,
        user_id: dayPrn.id,
        date: draftDay2,
        shift_type: 'day',
        site_id: 'default',
        status: 'scheduled',
        assignment_status: 'on_call',
      },
      {
        cycle_id: draftInsert.data.id,
        user_id: nightCore.id,
        date: draftDay1,
        shift_type: 'night',
        site_id: 'default',
        status: 'scheduled',
        assignment_status: 'call_in',
      },
      {
        cycle_id: liveInsert.data.id,
        user_id: dayCore.id,
        date: liveDay1,
        shift_type: 'day',
        site_id: 'default',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: liveInsert.data.id,
        user_id: nightCore.id,
        date: liveDay2,
        shift_type: 'night',
        site_id: 'default',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
    ])
    if (shiftsInsert.error) {
      throw new Error(`Could not seed shifts: ${shiftsInsert.error.message}`)
    }

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      draftCycle: {
        id: draftInsert.data.id,
        label: draftLabel,
        shortLabel: formatShortCycleLabel(draftStart, draftEnd),
      },
      liveCycle: {
        id: liveInsert.data.id,
        label: liveLabel,
        shortLabel: formatShortCycleLabel(liveStart, liveEnd),
      },
      dayCore: { id: dayCore.id, name: dayCoreName },
      dayPrn: { id: dayPrn.id, name: dayPrnName },
      nightCore: { id: nightCore.id, name: nightCoreName },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    if (createdCycleIds.length > 0) {
      await ctx.supabase
        .from('therapist_availability_submissions')
        .delete()
        .in('schedule_cycle_id', createdCycleIds)
      await ctx.supabase.from('availability_overrides').delete().in('cycle_id', createdCycleIds)
      await ctx.supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
      await ctx.supabase.from('schedule_cycles').delete().in('id', createdCycleIds)
    }

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('manager schedule route renders live roster data, filters by shift, and switches cycles', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')
    const smoke = ctx!

    await loginAs(page, smoke.manager.email, smoke.manager.password)
    await page.goto(`/schedule?cycle=${smoke.draftCycle.id}`)

    await expect(
      page.getByRole('heading', { name: 'Respiratory Therapy - Day Shift' })
    ).toBeVisible()
    await expect(
      page.getByText(`${smoke.draftCycle.label} (${smoke.draftCycle.shortLabel})`)
    ).toBeVisible()
    await expect(page.getByText('DRAFT', { exact: true })).toBeVisible()

    const dayCoreRow = page.locator('tr').filter({ hasText: smoke.dayCore.name }).first()
    const dayPrnRow = page.locator('tr').filter({ hasText: smoke.dayPrn.name }).first()
    await expect(dayCoreRow).toBeVisible()
    await expect(dayCoreRow).toContainText('OFF')
    await expect(dayPrnRow).toBeVisible()
    await expect(dayPrnRow).toContainText('OC')
    await expect(page.getByText(smoke.nightCore.name)).toHaveCount(0)

    await page.getByRole('button', { name: 'Night Shift' }).click()
    await expect(
      page.getByRole('heading', { name: 'Respiratory Therapy - Night Shift' })
    ).toBeVisible()
    const nightRow = page.locator('tr').filter({ hasText: smoke.nightCore.name }).first()
    await expect(nightRow).toBeVisible()
    await expect(nightRow).toContainText('CI')
    await expect(page.getByText(smoke.dayCore.name)).toHaveCount(0)

    await page.getByRole('combobox', { name: 'Cycle' }).selectOption({ value: smoke.liveCycle.id })
    await page.waitForURL(new RegExp(`/schedule\\?cycle=${smoke.liveCycle.id}$`), {
      timeout: 30_000,
    })
    await expect(
      page.getByText(`${smoke.liveCycle.label} (${smoke.liveCycle.shortLabel})`)
    ).toBeVisible()
    await expect(page.getByText('LIVE', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Day Shift' }).click()
    await expect(
      page.getByRole('heading', { name: 'Respiratory Therapy - Day Shift' })
    ).toBeVisible()
    await expect(page.locator('tr').filter({ hasText: smoke.dayCore.name }).first()).toContainText(
      '1'
    )
    await expect(page.getByText(smoke.nightCore.name)).toHaveCount(0)
  })
})
