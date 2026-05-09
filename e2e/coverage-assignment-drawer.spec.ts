import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  cycleId: string
  targetDate: string
  promotedLeadId: string
  promotedLeadName: string
  assignedLeadNames: string[]
}

test.describe.serial('coverage assignment drawer', () => {
  test.setTimeout(90_000)

  let ctx: TestContext | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const password = `Teamwise!${Math.random().toString(16).slice(2, 8)}`
    const manager = await createE2EUser(supabase, {
      email: `${randomString('drawer-manager')}@example.com`,
      password,
      fullName: 'Drawer Test Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const adrienneName = `Adrienne ${randomString('leadable')}`
    const barbaraName = `Barbara ${randomString('leadable')}`
    const lynnName = `Lynn ${randomString('staff')}`

    const adrienne = await createE2EUser(supabase, {
      email: `${randomString('drawer-adrienne')}@example.com`,
      password,
      fullName: adrienneName,
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    const barbara = await createE2EUser(supabase, {
      email: `${randomString('drawer-barbara')}@example.com`,
      password,
      fullName: barbaraName,
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    const lynn = await createE2EUser(supabase, {
      email: `${randomString('drawer-lynn')}@example.com`,
      password,
      fullName: lynnName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    createdUserIds.push(manager.id, adrienne.id, barbara.id, lynn.id)

    const cycleStart = addDays(new Date(), 1)
    const targetDate = formatDateKey(cycleStart)
    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Assignment Drawer ${randomString('cycle')}`,
        start_date: targetDate,
        end_date: formatDateKey(addDays(cycleStart, 41)),
        published: false,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(
        `Could not create coverage assignment drawer cycle: ${cycleInsert.error?.message ?? 'unknown error'}`
      )
    }

    createdCycleIds.push(cycleInsert.data.id)

    const shiftsInsert = await supabase.from('shifts').insert([
      {
        cycle_id: cycleInsert.data.id,
        user_id: adrienne.id,
        date: targetDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: cycleInsert.data.id,
        user_id: barbara.id,
        date: targetDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: cycleInsert.data.id,
        user_id: lynn.id,
        date: targetDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
    ])

    if (shiftsInsert.error) {
      throw new Error(`Could not seed missing-lead staff shifts: ${shiftsInsert.error.message}`)
    }

    ctx = {
      supabase,
      manager: { id: manager.id, email: `${randomString('unused')}@example.com`, password },
      cycleId: cycleInsert.data.id,
      targetDate,
      promotedLeadId: adrienne.id,
      promotedLeadName: adrienneName,
      assignedLeadNames: [adrienneName, barbaraName],
    }

    ctx.manager.email =
      (await supabase.from('profiles').select('email').eq('id', manager.id).single()).data?.email ??
      ctx.manager.email
  })

  test.afterAll(async () => {
    if (!ctx) return
    for (const cycleId of createdCycleIds) {
      await ctx.supabase.from('shifts').delete().eq('cycle_id', cycleId)
      await ctx.supabase.from('schedule_cycles').delete().eq('id', cycleId)
    }
    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('manager can scan and resolve a missing lead from assigned staff', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycleId}&view=week&shift=day`)

    const dayPanel = page.locator(`[data-testid="coverage-day-panel-${ctx!.targetDate}"]:visible`)
    await expect(dayPanel).toBeVisible({ timeout: 15_000 })
    await expect(dayPanel.getByText('Lead: Unassigned')).toBeVisible()
    await dayPanel.click()

    const drawer = page.getByTestId('coverage-shift-editor-dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('Resolve missing lead')).toBeVisible()
    await expect(drawer.getByText('Current staffing')).toBeVisible()
    await expect(drawer.getByText('Add or change staffing')).toBeVisible()
    await expect(drawer.getByText('Lead therapists')).toBeHidden()

    const resolveLeadPanel = drawer.getByTestId('coverage-resolve-lead-panel')
    for (const name of ctx!.assignedLeadNames) {
      await expect(resolveLeadPanel.getByText(name, { exact: false })).toBeVisible()
    }

    const quickLeadButtons = drawer.locator('[data-testid^="coverage-resolve-make-lead-"]')
    await expect(quickLeadButtons).toHaveCount(2)
    await expect(page.getByText('Compiling...')).toHaveCount(0, { timeout: 30_000 })
    await page.screenshot({
      path: 'output/playwright/coverage-assignment-drawer-desktop.png',
      fullPage: true,
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(drawer.getByText('Resolve missing lead')).toBeVisible()
    await page.screenshot({
      path: 'output/playwright/coverage-assignment-drawer-mobile.png',
      fullPage: true,
    })

    const setLeadResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/schedule/drag-drop') &&
        response.request().method() === 'POST',
      { timeout: 30_000 }
    )
    await quickLeadButtons.first().click()
    const response = await setLeadResponse
    expect(response.ok()).toBe(true)
    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('shifts')
          .select('role')
          .eq('cycle_id', ctx!.cycleId)
          .eq('date', ctx!.targetDate)
          .eq('shift_type', 'day')
          .eq('user_id', ctx!.promotedLeadId)
          .maybeSingle()

        if (result.error) throw new Error(result.error.message)
        return result.data?.role ?? null
      })
      .toBe('lead')
    await expect(drawer.getByText('Resolve missing lead')).toHaveCount(0)
    await expect(drawer.getByText(ctx!.promotedLeadName, { exact: false }).first()).toBeVisible()
    await expect(drawer.getByText('Missing lead')).toHaveCount(0)
  })
})
