import { expect, test, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { gotoWithRetry } from './helpers/navigation'
import { createScheduleCycle } from './helpers/schedule-cycles'
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
  liveDay2LeadShiftId: string
  liveDay2CandidateShiftId: string
}

function cellTestId(userId: string, isoDate: string) {
  return `cell-${userId}-${isoDate}`
}

async function clickShiftTab(page: Page, tabName: 'Day' | 'Night') {
  const button = page.getByRole('button', { name: tabName })
  const expected = new RegExp(`shift=${tabName.toLowerCase()}`)

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await expect(button).toBeEnabled()
    await button.click()
    if (
      await page.waitForURL(expected, { timeout: 5_000 }).then(
        () => true,
        () => false
      )
    ) {
      return
    }
    await page.waitForTimeout(500)
  }

  await expect(page).toHaveURL(expected, { timeout: 10_000 })
}

async function selectScheduleCycle(page: Page, cycleId: string) {
  const expectedUrl = new RegExp(`cycle=${cycleId}`)

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const cyclePicker = page.getByRole('combobox', { name: 'Schedule Block' })
    await expect(cyclePicker).toBeEnabled({ timeout: 30_000 })
    await cyclePicker.selectOption(cycleId)

    const [urlChanged, valueChanged] = await Promise.all([
      page.waitForURL(expectedUrl, { timeout: 5_000 }).then(
        () => true,
        () => false
      ),
      cyclePicker.inputValue().then(
        (value) => value === cycleId,
        () => false
      ),
    ])

    if (urlChanged && valueChanged) {
      await expect(page).toHaveURL(expectedUrl, { timeout: 30_000 })
      await expect(page.getByRole('combobox', { name: 'Schedule Block' })).toHaveValue(cycleId, {
        timeout: 30_000,
      })
      return
    }

    await page.waitForTimeout(750)
  }

  await expect(page).toHaveURL(expectedUrl, { timeout: 30_000 })
  await expect(page.getByRole('combobox', { name: 'Schedule Block' })).toHaveValue(cycleId, {
    timeout: 30_000,
  })
}

async function postScheduleDragDrop(page: Page, data: Record<string, unknown>) {
  const response = await page.request.post('/api/schedule/drag-drop', {
    headers: {
      origin: new URL(page.url()).origin,
      referer: page.url(),
    },
    data,
  })
  expect(response.ok(), await response.text()).toBe(true)
  return response
}

async function resetLiveDayCoreStatus(ctx: ManagerScheduleCtx) {
  const { error } = await ctx.supabase
    .from('shifts')
    .update({ assignment_status: 'scheduled', status: 'scheduled', role: 'staff' })
    .eq('cycle_id', ctx.liveCycle.id)
    .eq('user_id', ctx.dayCore.id)
    .eq('date', ctx.liveCycle.day1)
    .eq('shift_type', 'day')

  expect(error).toBeNull()
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

    const draftLabel = `Grid Draft ${randomString('draft')}`
    const liveLabel = `Grid Live ${randomString('live')}`
    const draftCycle = await createScheduleCycle(supabase, {
      label: draftLabel,
      startDate: addDays(new Date(), 3),
      published: false,
      siteId,
    })
    const liveCycle = await createScheduleCycle(supabase, {
      label: liveLabel,
      startDate: addDays(new Date(`${draftCycle.end_date}T00:00:00`), 1),
      published: true,
      siteId,
    })

    createdCycleIds.push(draftCycle.id, liveCycle.id)

    const draftStart = new Date(`${draftCycle.start_date}T00:00:00`)
    const liveStart = new Date(`${liveCycle.start_date}T00:00:00`)
    const draftDay1 = formatDateKey(draftStart)
    const draftDay2 = formatDateKey(addDays(draftStart, 1))
    const draftDay3 = formatDateKey(addDays(draftStart, 2))
    const liveDay1 = formatDateKey(liveStart)
    const liveDay2 = formatDateKey(addDays(liveStart, 1))

    const overrideInsert = await supabase.from('availability_overrides').insert([
      {
        therapist_id: dayCore.id,
        cycle_id: draftCycle.id,
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
        cycle_id: draftCycle.id,
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
        cycle_id: draftCycle.id,
        user_id: dayCore.id,
        date: draftDay1,
        shift_type: 'day',
        site_id: siteId,
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        cycle_id: draftCycle.id,
        user_id: dayPrn.id,
        date: draftDay2,
        shift_type: 'day',
        site_id: siteId,
        status: 'on_call',
        assignment_status: 'on_call',
        role: 'staff',
      },
      {
        cycle_id: draftCycle.id,
        user_id: nightCore.id,
        date: draftDay1,
        shift_type: 'night',
        site_id: siteId,
        status: 'called_off',
        assignment_status: 'call_in',
        role: 'staff',
      },
      {
        cycle_id: liveCycle.id,
        user_id: dayCore.id,
        date: liveDay1,
        shift_type: 'day',
        site_id: siteId,
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        cycle_id: liveCycle.id,
        user_id: nightCore.id,
        date: liveDay2,
        shift_type: 'night',
        site_id: siteId,
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        cycle_id: liveCycle.id,
        user_id: lead.id,
        date: liveDay2,
        shift_type: 'day',
        site_id: siteId,
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'lead',
      },
      {
        cycle_id: liveCycle.id,
        user_id: dayCore.id,
        date: liveDay2,
        shift_type: 'day',
        site_id: siteId,
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
    ])
    if (shiftsInsert.error) {
      throw new Error(`Could not seed shifts: ${shiftsInsert.error.message}`)
    }

    const liveDay2ShiftResult = await supabase
      .from('shifts')
      .select('id, user_id')
      .eq('cycle_id', liveCycle.id)
      .eq('date', liveDay2)
      .eq('shift_type', 'day')
      .in('user_id', [lead.id, dayCore.id])

    if (liveDay2ShiftResult.error) {
      throw new Error(`Could not load lead promotion shifts: ${liveDay2ShiftResult.error.message}`)
    }

    const liveDay2LeadShiftId =
      liveDay2ShiftResult.data?.find((shift) => shift.user_id === lead.id)?.id ?? null
    const liveDay2CandidateShiftId =
      liveDay2ShiftResult.data?.find((shift) => shift.user_id === dayCore.id)?.id ?? null

    if (!liveDay2LeadShiftId || !liveDay2CandidateShiftId) {
      throw new Error('Could not identify lead promotion shifts.')
    }

    ctx = {
      supabase,
      manager: {
        id: manager.id,
        email: managerEmail,
        password: managerPassword,
        name: managerName,
      },
      draftCycle: { id: draftCycle.id, label: draftLabel, day1: draftDay1, day2: draftDay2 },
      liveCycle: { id: liveCycle.id, label: liveLabel, day1: liveDay1, day2: liveDay2 },
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
      liveDay2LeadShiftId,
      liveDay2CandidateShiftId,
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
    await gotoWithRetry(page, '/coverage')
    await expect(page).toHaveURL(/\/schedule$/)

    await gotoWithRetry(page, '/coverage?shift=night')
    await expect(page).toHaveURL(/\/schedule\?shift=night$/)

    await gotoWithRetry(page, `/coverage?cycle=${smoke.draftCycle.id}&view=week&shift=day`)
    await expect(page).toHaveURL(/\/schedule\?.*cycle=.*shift=day/)

    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Schedule Block' })).toHaveValue(
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
      '.*'
    )

    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined)
    await clickShiftTab(page, 'Night')
    await expect(page.getByText(smoke.nightCore.name)).toBeVisible()
    await expect(page.getByText(smoke.dayCore.name)).toHaveCount(0)
    await expect(
      page.getByTestId(cellTestId(smoke.nightCore.id, smoke.draftCycle.day1))
    ).toHaveText('CI')

    await selectScheduleCycle(page, smoke.liveCycle.id)
    await expect(page.getByText('Published', { exact: true })).toBeVisible()
  })

  test('manager can assign requested-off draft cells, unassign, and designate lead inline', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')
    const smoke = ctx!

    await loginAs(page, smoke.manager.email, smoke.manager.password)
    await gotoWithRetry(page, `/schedule?cycle=${smoke.draftCycle.id}&shift=day`)

    const requestedOffCell = page.getByTestId(cellTestId(smoke.dayCore.id, smoke.draftCycle.day2))
    await expect(requestedOffCell).toHaveText('.*')
    await postScheduleDragDrop(page, {
      action: 'assign',
      cycleId: smoke.draftCycle.id,
      userId: smoke.dayCore.id,
      shiftType: 'day',
      date: smoke.draftCycle.day2,
      overrideWeeklyRules: true,
      availabilityOverride: true,
      availabilityOverrideReason: 'E2E manager confirmed requested-off assignment.',
    })
    await gotoWithRetry(page, `/schedule?cycle=${smoke.draftCycle.id}&shift=day`)
    await expect(requestedOffCell).toHaveText('1*', { timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Assign anyway' })).toHaveCount(0, {
      timeout: 30_000,
    })
    await expect(requestedOffCell).toBeEnabled({ timeout: 30_000 })

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

    await postScheduleDragDrop(page, {
      action: 'remove',
      cycleId: smoke.draftCycle.id,
      shiftId: inserted.data!.id,
    })
    await gotoWithRetry(page, `/schedule?cycle=${smoke.draftCycle.id}&shift=day`)
    await expect(requestedOffCell).toHaveText('.*', { timeout: 30_000 })

    await expect
      .poll(
        async () => {
          const { data } = await smoke.supabase
            .from('shifts')
            .select('id')
            .eq('cycle_id', smoke.draftCycle.id)
            .eq('user_id', smoke.dayCore.id)
            .eq('date', smoke.draftCycle.day2)
            .eq('shift_type', 'day')
            .maybeSingle()
          return data?.id ?? null
        },
        { timeout: 30_000 }
      )
      .toBeNull()
    await gotoWithRetry(page, `/schedule?cycle=${smoke.draftCycle.id}&shift=day`)

    const cell = page.getByTestId(cellTestId(smoke.dayCore.id, smoke.draftCycle.day1))
    await expect(cell).toHaveText('1', { timeout: 30_000 })
    await expect(cell).toBeEnabled({ timeout: 30_000 })
    await postScheduleDragDrop(page, {
      action: 'set_lead',
      cycleId: smoke.draftCycle.id,
      therapistId: smoke.dayCore.id,
      date: smoke.draftCycle.day1,
      shiftType: 'day',
      overrideWeeklyRules: true,
    })
    await gotoWithRetry(page, `/schedule?cycle=${smoke.draftCycle.id}&shift=day`)
    await expect
      .poll(
        async () => {
          const { data } = await smoke.supabase
            .from('shifts')
            .select('role')
            .eq('cycle_id', smoke.draftCycle.id)
            .eq('user_id', smoke.dayCore.id)
            .eq('date', smoke.draftCycle.day1)
            .eq('shift_type', 'day')
            .maybeSingle()
          return data?.role ?? null
        },
        { timeout: 30_000 }
      )
      .toBe('lead')
    await expect(page.getByTestId(cellTestId(smoke.dayCore.id, smoke.draftCycle.day1))).toHaveClass(
      /bg-yellow-200/,
      { timeout: 30_000 }
    )
  })

  test('manager can update published assignment status from the same grid', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')
    const smoke = ctx!

    await resetLiveDayCoreStatus(smoke)
    await loginAs(page, smoke.manager.email, smoke.manager.password)
    await gotoWithRetry(page, `/schedule?cycle=${smoke.liveCycle.id}&shift=day`)

    const liveCell = page.getByTestId(cellTestId(smoke.dayCore.id, smoke.liveCycle.day1))
    await expect(liveCell).toHaveText(/^(1|OC)$/, { timeout: 30_000 })
    await expect(page.getByText('Published', { exact: true })).toBeVisible()
    const currentStatus = (await liveCell.textContent())?.trim()
    const expectedStatusText = currentStatus === 'OC' ? '1' : 'OC'
    const nextStatus = currentStatus === 'OC' ? 'scheduled' : 'on_call'
    const liveShift = await smoke.supabase
      .from('shifts')
      .select('id')
      .eq('cycle_id', smoke.liveCycle.id)
      .eq('user_id', smoke.dayCore.id)
      .eq('date', smoke.liveCycle.day1)
      .single()
    expect(liveShift.error).toBeNull()
    expect(liveShift.data?.id).toBeTruthy()
    const statusResponse = await page.request.post('/api/schedule/assignment-status', {
      headers: {
        origin: new URL(page.url()).origin,
        referer: page.url(),
      },
      data: {
        assignmentId: liveShift.data!.id,
        status: nextStatus,
      },
    })
    expect(statusResponse.ok(), await statusResponse.text()).toBe(true)
    await gotoWithRetry(page, `/schedule?cycle=${smoke.liveCycle.id}&shift=day`)
    await expect(liveCell).toHaveText(expectedStatusText, { timeout: 30_000 })

    const updated = await smoke.supabase
      .from('shifts')
      .select('assignment_status')
      .eq('cycle_id', smoke.liveCycle.id)
      .eq('user_id', smoke.dayCore.id)
      .eq('date', smoke.liveCycle.day1)
      .single()
    expect(updated.error).toBeNull()
    expect(updated.data?.assignment_status).toBe(nextStatus)
  })

  test('manager sees lead promotion reflected in active staffing totals after Call In', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')
    const smoke = ctx!

    await loginAs(page, smoke.manager.email, smoke.manager.password)
    await gotoWithRetry(page, `/schedule?cycle=${smoke.liveCycle.id}&shift=day`)

    const leadCell = page.getByTestId(cellTestId(smoke.lead.id, smoke.liveCycle.day2))
    const candidateCell = page.getByTestId(cellTestId(smoke.dayCore.id, smoke.liveCycle.day2))
    await expect(leadCell).toHaveText('1', { timeout: 30_000 })
    await expect(leadCell).toHaveClass(/bg-yellow-200/)
    await expect(leadCell).toHaveClass(/border-yellow-300/)
    await expect(candidateCell).toHaveText('1', { timeout: 30_000 })
    await expect(page.getByTestId(`total-${smoke.liveCycle.day2}`)).toHaveText('2')

    const statusResponse = await page.request.post('/api/schedule/assignment-status', {
      headers: {
        origin: new URL(page.url()).origin,
        referer: page.url(),
      },
      data: {
        assignmentId: smoke.liveDay2LeadShiftId,
        status: 'call_in',
      },
    })
    expect(statusResponse.ok(), await statusResponse.text()).toBe(true)

    await expect
      .poll(
        async () => {
          const { data, error } = await smoke.supabase
            .from('shifts')
            .select('id, role')
            .in('id', [smoke.liveDay2LeadShiftId, smoke.liveDay2CandidateShiftId])

          if (error) throw new Error(error.message)

          const originalLeadRole =
            data?.find((shift) => shift.id === smoke.liveDay2LeadShiftId)?.role ?? null
          const promotedRole =
            data?.find((shift) => shift.id === smoke.liveDay2CandidateShiftId)?.role ?? null

          return `${originalLeadRole}:${promotedRole}`
        },
        { timeout: 30_000 }
      )
      .toBe('staff:lead')

    await gotoWithRetry(page, `/schedule?cycle=${smoke.liveCycle.id}&shift=day`)
    await expect(leadCell).toHaveText('CI', { timeout: 30_000 })
    await expect(candidateCell).toHaveText('1', { timeout: 30_000 })
    await expect(candidateCell).toHaveClass(/bg-yellow-200/, { timeout: 30_000 })
    await expect(page.getByTestId(`total-${smoke.liveCycle.day2}`)).toHaveText('1')
  })

  test('lead can update status but cannot see assignment controls', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')
    const smoke = ctx!

    await resetLiveDayCoreStatus(smoke)
    await loginAs(page, smoke.lead.email, smoke.lead.password)
    await gotoWithRetry(page, `/schedule?cycle=${smoke.liveCycle.id}&shift=day`)

    await expect(page.getByText('Published', { exact: true })).toBeVisible()
    await expect(page.getByText('Draft', { exact: true })).toHaveCount(0)

    const assignedCell = page.getByTestId(cellTestId(smoke.dayCore.id, smoke.liveCycle.day1))
    await expect(assignedCell).toBeEnabled()
    await expect(assignedCell).toHaveText(/^(1|OC)$/, { timeout: 30_000 })
    const currentStatus = (await assignedCell.textContent())?.trim()
    const expectedStatusText = currentStatus === 'OC' ? '1' : 'OC'
    const nextStatus = currentStatus === 'OC' ? 'scheduled' : 'on_call'
    const liveShift = await smoke.supabase
      .from('shifts')
      .select('id')
      .eq('cycle_id', smoke.liveCycle.id)
      .eq('user_id', smoke.dayCore.id)
      .eq('date', smoke.liveCycle.day1)
      .single()
    expect(liveShift.error).toBeNull()
    expect(liveShift.data?.id).toBeTruthy()
    const statusResponse = await page.request.post('/api/schedule/assignment-status', {
      headers: {
        origin: new URL(page.url()).origin,
        referer: page.url(),
      },
      data: {
        assignmentId: liveShift.data!.id,
        status: nextStatus,
      },
    })
    expect(statusResponse.ok(), await statusResponse.text()).toBe(true)
    await gotoWithRetry(page, `/schedule?cycle=${smoke.liveCycle.id}&shift=day`)
    await expect(assignedCell).toHaveText(expectedStatusText, { timeout: 30_000 })
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
    await gotoWithRetry(page, '/therapist/schedule')
    await expect(page).toHaveURL(/\/schedule$/)

    await gotoWithRetry(page, `/schedule?cycle=${smoke.liveCycle.id}`)

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
