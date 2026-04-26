import { expect, test, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  therapist1: { id: string; fullName: string }
  therapist2: { id: string; fullName: string }
  therapist3: { id: string; fullName: string }
  cycle: { id: string }
  targetDate: string
  assignDate: string
}

test.describe.serial('coverage manager dialog interactions', () => {
  let ctx: TestContext | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('cov-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'E2E Cov Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const therapist1FullName = `E2E Cov Lead ${randomString('t1')}`
    const therapist1 = await createE2EUser(supabase, {
      email: `${randomString('cov-t1')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapist1FullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const therapist2FullName = `E2E Cov Staff ${randomString('t2')}`
    const therapist2 = await createE2EUser(supabase, {
      email: `${randomString('cov-t2')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapist2FullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    const therapist3FullName = `E2E Cov PRN ${randomString('t3')}`
    const therapist3 = await createE2EUser(supabase, {
      email: `${randomString('cov-t3')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapist3FullName,
      role: 'therapist',
      employmentType: 'prn',
      shiftType: 'day',
      isLeadEligible: false,
    })

    createdUserIds.push(manager.id, therapist1.id, therapist2.id, therapist3.id)

    const start = new Date()
    start.setDate(start.getDate() - 1)
    const end = new Date(start)
    end.setDate(end.getDate() + 41)

    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: randomString('E2E Cov Cycle'),
        start_date: formatDateKey(start),
        end_date: formatDateKey(end),
        published: false,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(
        `Could not create test cycle: ${cycleInsert.error?.message ?? 'unknown error'}`
      )
    }

    createdCycleIds.push(cycleInsert.data.id)

    const targetDateObj = new Date(start)
    targetDateObj.setDate(targetDateObj.getDate() + 5)
    const targetDate = formatDateKey(targetDateObj)

    const assignDateObj = new Date(start)
    assignDateObj.setDate(assignDateObj.getDate() + 15)
    const assignDate = formatDateKey(assignDateObj)

    const shiftsInsert = await supabase.from('shifts').insert([
      {
        cycle_id: cycleInsert.data.id,
        user_id: therapist1.id,
        date: targetDate,
        shift_type: 'day',
        role: 'lead',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: cycleInsert.data.id,
        user_id: therapist2.id,
        date: targetDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: cycleInsert.data.id,
        user_id: therapist3.id,
        date: targetDate,
        shift_type: 'night',
        role: 'staff',
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
      therapist1: { id: therapist1.id, fullName: therapist1FullName },
      therapist2: { id: therapist2.id, fullName: therapist2FullName },
      therapist3: { id: therapist3.id, fullName: therapist3FullName },
      cycle: { id: cycleInsert.data.id },
      targetDate,
      assignDate,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return
    for (const cycleId of createdCycleIds) {
      await ctx.supabase.from('shifts').delete().eq('cycle_id', cycleId)
      await ctx.supabase.from('schedule_cycles').delete().eq('id', cycleId)
    }
    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
  })

  function dayCell(page: Page, isoDate: string) {
    return page.locator(`[data-testid="coverage-day-panel-${isoDate}"]:visible`).first()
  }

  function shiftEditorDialog(page: Page) {
    return page.getByTestId('coverage-shift-editor-dialog')
  }

  async function waitForCalendar(page: Page, isoDate: string) {
    await expect(dayCell(page, isoDate)).toBeVisible({ timeout: 15_000 })
  }

  async function openShiftEditor(page: Page, isoDate: string) {
    await page.waitForTimeout(1000)
    const clicked = await page.evaluate((targetDate) => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          `[data-testid="coverage-day-cell-button-${targetDate}"]`
        )
      )
      const visible = candidates.find((element) => {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        )
      })
      if (!visible) return false
      visible.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      return true
    }, isoDate)
    expect(clicked).toBe(true)
    await expect(shiftEditorDialog(page)).toBeVisible({ timeout: 5_000 })
  }

  test('clicking a day cell background opens the shift editor dialog', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    await waitForCalendar(page, ctx!.assignDate)
    await openShiftEditor(page, ctx!.assignDate)
    await expect(page.getByTestId('coverage-drawer-close')).toHaveCount(0)
  })

  test('clicking an assigned therapist opens the status popover only', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    await waitForCalendar(page, ctx!.targetDate)
    const triggerClicked = await page.evaluate(
      ({ date, therapistId }) => {
        const candidates = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            `[data-testid="coverage-assignment-trigger-${date}-${therapistId}"]`
          )
        )
        const visible = candidates.find((element) => {
          const rect = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
          )
        })
        if (!visible) return false
        visible.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        return true
      },
      { date: ctx!.targetDate, therapistId: ctx!.therapist1.id }
    )
    expect(triggerClicked).toBe(true)

    await expect
      .poll(
        async () =>
          page.evaluate(
            () => document.querySelectorAll('[data-testid=\"coverage-status-popover\"]').length
          ),
        { timeout: 10_000 }
      )
      .toBeGreaterThan(0)
    await page.waitForTimeout(1000)
    await expect(page.getByRole('button', { name: 'Call In' })).toBeVisible({ timeout: 5_000 })
    await expect(shiftEditorDialog(page)).toHaveCount(0)
  })

  test('clicking the Close button dismisses the shift editor dialog', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    await waitForCalendar(page, ctx!.assignDate)
    await openShiftEditor(page, ctx!.assignDate)

    const closed = await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>(
        '[data-testid=\"coverage-shift-editor-dialog\"] [data-slot=\"dialog-close\"]'
      )
      button?.click()
      return Boolean(button)
    })
    expect(closed).toBe(true)
    await expect(shiftEditorDialog(page)).toHaveCount(0)
  })

  test('assigning and unassigning a therapist works through the shift editor dialog', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')
    test.setTimeout(60_000)

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    await waitForCalendar(page, ctx!.assignDate)
    await openShiftEditor(page, ctx!.assignDate)

    await expect(
      page.getByTestId(`coverage-assign-toggle-${ctx!.therapist2.id}-staff`)
    ).toBeVisible()
    await page.getByTestId(`coverage-assign-toggle-${ctx!.therapist2.id}-staff`).click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('shifts')
            .select('id')
            .eq('cycle_id', ctx!.cycle.id)
            .eq('user_id', ctx!.therapist2.id)
            .eq('date', ctx!.assignDate)
            .eq('shift_type', 'day')
          if (result.error) throw new Error(result.error.message)
          return result.data?.length ?? 0
        },
        { timeout: 20_000 }
      )
      .toBe(1)

    const unassignButton = page.getByRole('button', {
      name: `Unassign ${ctx!.therapist2.fullName}`,
    })
    await expect(unassignButton).toBeVisible({ timeout: 15_000 })

    await unassignButton.click()
    await expect(
      page.getByTestId(`coverage-assign-toggle-${ctx!.therapist2.id}-staff`)
    ).toBeVisible()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('shifts')
            .select('id')
            .eq('cycle_id', ctx!.cycle.id)
            .eq('user_id', ctx!.therapist2.id)
            .eq('date', ctx!.assignDate)
            .eq('shift_type', 'day')
          if (result.error) throw new Error(result.error.message)
          return result.data?.length ?? 0
        },
        { timeout: 20_000 }
      )
      .toBe(0)
  })
})
