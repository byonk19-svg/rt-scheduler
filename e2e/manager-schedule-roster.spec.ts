import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TestUser = { id: string; email: string; password: string; name: string }

type ManagerScheduleCtx = {
  supabase: SupabaseClient
  manager: TestUser
  draftCycle: { id: string; label: string; day1: string; day2: string }
  liveCycle: { id: string; label: string; day1: string; day2: string }
  dayCore: TestUser
  dayPrn: TestUser
  nightCore: TestUser
  lead: TestUser
}

function cellTestId(userId: string, isoDate: string) {
  return `cell-${userId}-${isoDate}`
}

function nextSunday(from = new Date()): Date {
  const start = new Date(from)
  start.setDate(start.getDate() + ((7 - start.getDay()) % 7))
  return start
}

test.describe.serial('unified schedule grid route', () => {
  test.setTimeout(120_000)

  let ctx: ManagerScheduleCtx | null = null
  let cleanupSupabase: SupabaseClient | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []
  const createdSiteIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return
    cleanupSupabase = supabase
    const siteId = randomString('grid-site')
    const siteInsert = await supabase.from('sites').insert({
      id: siteId,
      name: `Schedule Grid ${siteId}`,
    })
    if (siteInsert.error) {
      throw new Error(`Could not create test site: ${siteInsert.error.message}`)
    }
    createdSiteIds.push(siteId)

    const managerEmail = `${randomString('sched-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 10)}`
    const managerName = `Schedule Manager ${randomString('mgr')}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: managerName,
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
      siteId,
    })
    createdUserIds.push(manager.id)

    const dayCoreName = `Grid Day Core ${randomString('daycore')}`
    const dayCoreEmail = `${randomString('daycore')}@example.com`
    const dayCorePassword = `Ther!${Math.random().toString(16).slice(2, 10)}`
    const dayCore = await createE2EUser(supabase, {
      email: dayCoreEmail,
      password: dayCorePassword,
      fullName: dayCoreName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
      siteId,
    })
    createdUserIds.push(dayCore.id)

    const dayPrnName = `Grid Day PRN ${randomString('dayprn')}`
    const dayPrnEmail = `${randomString('dayprn')}@example.com`
    const dayPrnPassword = `Ther!${Math.random().toString(16).slice(2, 10)}`
    const dayPrn = await createE2EUser(supabase, {
      email: dayPrnEmail,
      password: dayPrnPassword,
      fullName: dayPrnName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
      siteId,
    })
    createdUserIds.push(dayPrn.id)

    const nightCoreName = `Grid Night Core ${randomString('nightcore')}`
    const nightCoreEmail = `${randomString('nightcore')}@example.com`
    const nightCorePassword = `Ther!${Math.random().toString(16).slice(2, 10)}`
    const nightCore = await createE2EUser(supabase, {
      email: nightCoreEmail,
      password: nightCorePassword,
      fullName: nightCoreName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'night',
      isLeadEligible: false,
      siteId,
    })
    createdUserIds.push(nightCore.id)

    const leadName = `Grid Lead ${randomString('lead')}`
    const leadEmail = `${randomString('lead')}@example.com`
    const leadPassword = `Lead!${Math.random().toString(16).slice(2, 10)}`
    const lead = await createE2EUser(supabase, {
      email: leadEmail,
      password: leadPassword,
      fullName: leadName,
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
      siteId,
    })
    createdUserIds.push(lead.id)

    const draftStart = nextSunday(addDays(new Date(), 3))
    const draftEnd = addDays(draftStart, 41)
    const liveStart = addDays(draftEnd, 1)
    const liveEnd = addDays(liveStart, 41)

    const draftLabel = `Grid Draft ${randomString('draft')}`
    const liveLabel = `Grid Live ${randomString('live')}`
    const draftInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: draftLabel,
        start_date: formatDateKey(draftStart),
        end_date: formatDateKey(draftEnd),
        published: false,
        site_id: siteId,
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
        site_id: siteId,
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

    const overrideInsert = await supabase.from('availability_overrides').insert([
      {
        therapist_id: dayCore.id,
        cycle_id: draftInsert.data.id,
        date: draftDay2,
        shift_type: 'day',
        override_type: 'force_off',
        intent: 'therapist_need_off',
        note: 'unified schedule off',
        created_by: dayCore.id,
        source: 'therapist',
      },
      {
        therapist_id: nightCore.id,
        cycle_id: draftInsert.data.id,
        date: draftDay3,
        shift_type: 'night',
        override_type: 'force_off',
        intent: 'therapist_need_off',
        note: 'unified schedule night off',
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
        site_id: siteId,
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        cycle_id: draftInsert.data.id,
        user_id: dayPrn.id,
        date: draftDay2,
        shift_type: 'day',
        site_id: siteId,
        status: 'on_call',
        assignment_status: 'on_call',
        role: 'staff',
      },
      {
        cycle_id: draftInsert.data.id,
        user_id: nightCore.id,
        date: draftDay1,
        shift_type: 'night',
        site_id: siteId,
        status: 'called_off',
        assignment_status: 'call_in',
        role: 'staff',
      },
      {
        cycle_id: liveInsert.data.id,
        user_id: dayCore.id,
        date: liveDay1,
        shift_type: 'day',
        site_id: siteId,
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        cycle_id: liveInsert.data.id,
        user_id: nightCore.id,
        date: liveDay2,
        shift_type: 'night',
        site_id: siteId,
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
    ])
    if (shiftsInsert.error) {
      throw new Error(`Could not seed shifts: ${shiftsInsert.error.message}`)
    }

    ctx = {
      supabase,
      manager: {
        id: manager.id,
        email: managerEmail,
        password: managerPassword,
        name: managerName,
      },
      draftCycle: { id: draftInsert.data.id, label: draftLabel, day1: draftDay1, day2: draftDay2 },
      liveCycle: { id: liveInsert.data.id, label: liveLabel, day1: liveDay1, day2: liveDay2 },
      dayCore: {
        id: dayCore.id,
        email: dayCoreEmail,
        password: dayCorePassword,
        name: dayCoreName,
      },
      dayPrn: { id: dayPrn.id, email: dayPrnEmail, password: dayPrnPassword, name: dayPrnName },
      nightCore: {
        id: nightCore.id,
        email: nightCoreEmail,
        password: nightCorePassword,
        name: nightCoreName,
      },
      lead: {
        id: lead.id,
        email: leadEmail,
        password: leadPassword,
        name: leadName,
      },
    }
  })

  test.afterAll(async () => {
    const supabase = ctx?.supabase ?? cleanupSupabase
    if (!supabase) return

    if (createdCycleIds.length > 0) {
      await supabase.from('availability_overrides').delete().in('cycle_id', createdCycleIds)
      await supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
      await supabase.from('schedule_cycles').delete().in('id', createdCycleIds)
    }

    for (const userId of createdUserIds) {
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
    if (createdSiteIds.length > 0) {
      await supabase.from('sites').delete().in('id', createdSiteIds)
    }
  })

  test('manager sees one schedule grid, legacy coverage redirects, and shift/cycle controls work', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')
    const smoke = ctx!

    await loginAs(page, smoke.manager.email, smoke.manager.password)
    await page.goto('/coverage')
    await expect(page).toHaveURL(/\/schedule$/)

    await page.goto('/coverage?shift=night')
    await expect(page).toHaveURL(/\/schedule\?shift=night$/)

    await page.goto(`/coverage?cycle=${smoke.draftCycle.id}&view=week&shift=day`)
    await expect(page).toHaveURL(/\/schedule\?.*cycle=.*shift=day/)

    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Schedule cycle' })).toHaveValue(
      smoke.draftCycle.id
    )
    await expect(page.getByText('Draft', { exact: true })).toBeVisible()
    await expect(page.getByText('Coverage', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Roster View', { exact: true })).toHaveCount(0)

    await expect(page.getByText(smoke.dayCore.name)).toBeVisible()
    await expect(page.getByText(smoke.dayPrn.name)).toBeVisible()
    await expect(page.getByText(smoke.nightCore.name)).toHaveCount(0)
    await expect(page.getByTestId(cellTestId(smoke.dayPrn.id, smoke.draftCycle.day2))).toHaveText(
      'OC'
    )
    await expect(page.getByTestId(cellTestId(smoke.dayCore.id, smoke.draftCycle.day2))).toHaveText(
      '·*'
    )

    await page.getByRole('button', { name: 'Night' }).click()
    await expect(page).toHaveURL(/shift=night/)
    await expect(page.getByText(smoke.nightCore.name)).toBeVisible()
    await expect(page.getByText(smoke.dayCore.name)).toHaveCount(0)
    await expect(
      page.getByTestId(cellTestId(smoke.nightCore.id, smoke.draftCycle.day1))
    ).toHaveText('CI')

    await page.getByRole('combobox', { name: 'Schedule cycle' }).selectOption(smoke.liveCycle.id)
    await expect(page).toHaveURL(new RegExp(`cycle=${smoke.liveCycle.id}`))
    await expect(page.getByText('Published', { exact: true })).toBeVisible()
  })

  test('manager can assign requested-off draft cells, unassign, and designate lead inline', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')
    const smoke = ctx!

    await loginAs(page, smoke.manager.email, smoke.manager.password)
    await page.goto(`/schedule?cycle=${smoke.draftCycle.id}&shift=day`)

    const requestedOffCell = page.getByTestId(cellTestId(smoke.dayCore.id, smoke.draftCycle.day2))
    await expect(requestedOffCell).toHaveText('·*')
    await requestedOffCell.click()
    await expect(page.getByText('Requested this day off.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Assign anyway' })).toBeVisible()
    await page.getByRole('button', { name: 'Assign anyway' }).click()
    await expect(requestedOffCell).toHaveText('1*', { timeout: 30_000 })

    const inserted = await smoke.supabase
      .from('shifts')
      .select('id, availability_override, availability_override_reason')
      .eq('cycle_id', smoke.draftCycle.id)
      .eq('user_id', smoke.dayCore.id)
      .eq('date', smoke.draftCycle.day2)
      .eq('shift_type', 'day')
      .single()
    expect(inserted.error).toBeNull()
    expect(inserted.data?.availability_override).toBe(true)

    await requestedOffCell.click()
    await page.getByRole('button', { name: 'Unassign' }).click()
    await expect(requestedOffCell).toHaveText('·*', { timeout: 30_000 })

    const scheduledCell = page.getByTestId(cellTestId(smoke.dayCore.id, smoke.draftCycle.day1))
    await scheduledCell.click()
    await page.getByRole('button', { name: 'Designate as lead' }).click()
    await expect(scheduledCell).toHaveClass(/bg-yellow-200/, { timeout: 30_000 })
  })

  test('manager can update published assignment status from the same grid', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')
    const smoke = ctx!

    await loginAs(page, smoke.manager.email, smoke.manager.password)
    await page.goto(`/schedule?cycle=${smoke.liveCycle.id}&shift=day`)

    const liveCell = page.getByTestId(cellTestId(smoke.dayCore.id, smoke.liveCycle.day1))
    await expect(page.getByText('Published', { exact: true })).toBeVisible()
    await liveCell.click()
    await expect(page.getByRole('button', { name: 'On call' })).toBeVisible()
    await page.getByRole('button', { name: 'On call' }).click()
    await expect(liveCell).toHaveText('OC', { timeout: 30_000 })

    const updated = await smoke.supabase
      .from('shifts')
      .select('assignment_status')
      .eq('cycle_id', smoke.liveCycle.id)
      .eq('user_id', smoke.dayCore.id)
      .eq('date', smoke.liveCycle.day1)
      .single()
    expect(updated.error).toBeNull()
    expect(updated.data?.assignment_status).toBe('on_call')
  })

  test('lead can update status but cannot see assignment controls', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')
    const smoke = ctx!

    await loginAs(page, smoke.lead.email, smoke.lead.password)
    await page.goto(`/schedule?cycle=${smoke.liveCycle.id}&shift=day`)

    await expect(page.getByText('Published', { exact: true })).toBeVisible()
    await expect(page.getByText('Draft', { exact: true })).toHaveCount(0)

    const assignedCell = page.getByTestId(cellTestId(smoke.dayCore.id, smoke.liveCycle.day1))
    await expect(assignedCell).toBeEnabled()
    await assignedCell.click()
    await expect(page.getByRole('button', { name: 'On call' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Unassign' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Designate as lead' })).toHaveCount(0)

    const emptyCell = page.getByTestId(cellTestId(smoke.lead.id, smoke.liveCycle.day1))
    await expect(emptyCell).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Assign anyway' })).toHaveCount(0)
  })

  test('therapist sees the same schedule as read-only with their row pinned', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')
    const smoke = ctx!

    await loginAs(page, smoke.dayCore.email, smoke.dayCore.password)
    await page.goto('/therapist/schedule')
    await expect(page).toHaveURL(/\/schedule$/)

    await page.goto(`/schedule?cycle=${smoke.liveCycle.id}`)

    const firstBodyRow = page.locator('tbody tr').first()
    await expect(firstBodyRow).toContainText(`You (${smoke.dayCore.name})`)
    await expect(page.getByRole('button', { name: 'Auto-draft' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Publish ->' })).toHaveCount(0)
    await expect(
      page.getByTestId(cellTestId(smoke.dayCore.id, smoke.liveCycle.day1))
    ).toBeDisabled()
    await expect(page.getByRole('button', { name: 'On call' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Unassign' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Designate as lead' })).toHaveCount(0)
  })
})
