import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, getEnv } from './helpers/env'
import { createServiceRoleClientOrNull } from './helpers/supabase'

type LiveSmokeContext = {
  supabase: SupabaseClient
  manager: { email: string; password: string }
  cycle: { id: string; targetDate: string }
  therapist: { id: string; fullName: string }
}

function dayCell(page: import('@playwright/test').Page, isoDate: string) {
  return page.locator(`[data-testid="coverage-day-panel-${isoDate}"]:visible`).first()
}

function dayCellButton(page: import('@playwright/test').Page, isoDate: string) {
  return page.locator(`[data-testid="coverage-day-cell-button-${isoDate}"]:visible`).first()
}

function shiftEditorDialog(page: import('@playwright/test').Page) {
  return page.getByTestId('coverage-shift-editor-dialog')
}

test.describe.serial('coverage manager live smoke', () => {
  test.setTimeout(120_000)

  let ctx: LiveSmokeContext | null = null

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    const managerEmail = getEnv('E2E_USER_EMAIL')
    const managerPassword = getEnv('E2E_USER_PASSWORD')
    if (!supabase || !managerEmail || !managerPassword) return

    const cycleResult = await supabase
      .from('schedule_cycles')
      .select('id, start_date, archived_at')
      .is('archived_at', null)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cycleResult.error) {
      throw new Error(`Could not load live coverage cycle: ${cycleResult.error.message}`)
    }
    if (!cycleResult.data?.id || !cycleResult.data.start_date) {
      throw new Error('Expected an active live coverage cycle for the manager smoke.')
    }

    const therapistResult = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'therapist')
      .eq('shift_type', 'day')
      .eq('employment_type', 'full_time')
      .eq('is_active', true)
      .eq('on_fmla', false)
      .order('full_name', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (therapistResult.error || !therapistResult.data?.id || !therapistResult.data.full_name) {
      throw new Error(
        therapistResult.error?.message ??
          'Expected an active full-time day therapist for the live smoke.'
      )
    }

    let targetDate = cycleResult.data.start_date
    for (let offset = 0; offset < 7; offset += 1) {
      const candidate = formatDateKey(
        addDays(new Date(`${cycleResult.data.start_date}T00:00:00`), offset)
      )
      const existingShift = await supabase
        .from('shifts')
        .select('id')
        .eq('cycle_id', cycleResult.data.id)
        .eq('user_id', therapistResult.data.id)
        .eq('date', candidate)
        .eq('shift_type', 'day')
        .maybeSingle()

      if (existingShift.error) {
        throw new Error(existingShift.error.message)
      }

      if (!existingShift.data?.id) {
        targetDate = candidate
        break
      }
    }

    ctx = {
      supabase,
      manager: { email: managerEmail, password: managerPassword },
      cycle: { id: cycleResult.data.id, targetDate },
      therapist: { id: therapistResult.data.id, fullName: therapistResult.data.full_name },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase
      .from('shifts')
      .delete()
      .eq('cycle_id', ctx.cycle.id)
      .eq('user_id', ctx.therapist.id)
      .eq('date', ctx.cycle.targetDate)
      .eq('shift_type', 'day')
  })

  test('manager can assign, update status, and unassign from the live coverage workspace', async ({
    page,
  }) => {
    test.skip(!ctx, 'Live coverage smoke requires service-role env plus demo manager credentials.')

    const statusRequests: Array<{ url: string; method: string; postData: string | null }> = []
    const statusResponses: Array<{ url: string; status: number; body: string }> = []
    let assignedShiftId: string | null = null
    page.on('request', (request) => {
      if (!request.url().includes('/api/schedule/assignment-status')) return
      statusRequests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
      })
    })
    page.on('response', async (response) => {
      if (!response.url().includes('/api/schedule/assignment-status')) return
      statusResponses.push({
        url: response.url(),
        status: response.status(),
        body: await response.text().catch(() => ''),
      })
    })

    const coverageHref = `/coverage?cycle=${ctx!.cycle.id}&view=week&shift=day`
    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(coverageHref, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    await expect(dayCell(page, ctx!.cycle.targetDate)).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(2_000)
    await dayCellButton(page, ctx!.cycle.targetDate).click({ position: { x: 18, y: 18 } })
    await page.waitForTimeout(500)
    await expect(shiftEditorDialog(page)).toBeVisible({ timeout: 10_000 })

    const assignToggle = page.getByTestId(`coverage-assign-toggle-${ctx!.therapist.id}-staff`)
    await expect(assignToggle).toBeVisible({ timeout: 10_000 })
    await assignToggle.click()

    const assignmentTrigger = page
      .locator(
        `[data-testid="coverage-assignment-trigger-${ctx!.cycle.targetDate}-${ctx!.therapist.id}"]:visible`
      )
      .first()

    await expect
      .poll(
        async () => {
          const shift = await ctx!.supabase
            .from('shifts')
            .select('id, assignment_status')
            .eq('cycle_id', ctx!.cycle.id)
            .eq('user_id', ctx!.therapist.id)
            .eq('date', ctx!.cycle.targetDate)
            .eq('shift_type', 'day')
            .maybeSingle()

          if (shift.error) throw new Error(shift.error.message)
          assignedShiftId = shift.data?.id ?? null
          return shift.data?.id ?? null
        },
        { timeout: 20_000 }
      )
      .not.toBeNull()

    await expect(assignmentTrigger).toBeVisible({ timeout: 15_000 })
    await shiftEditorDialog(page).getByRole('button', { name: 'Close' }).click()
    await expect(shiftEditorDialog(page)).toHaveCount(0)

    await assignmentTrigger.click()
    const statusPopover = page.locator('[data-testid="coverage-status-popover"]:visible').first()
    await expect(statusPopover).toBeVisible({ timeout: 10_000 })
    await statusPopover.getByRole('button', { name: 'On Call' }).click({ force: true })
    await expect.poll(() => statusRequests.length, { timeout: 10_000 }).toBeGreaterThan(0)
    await expect.poll(() => statusResponses.at(-1)?.status ?? null, { timeout: 10_000 }).toBe(200)

    await expect
      .poll(
        async () => {
          const entry = await ctx!.supabase
            .from('shift_operational_entries')
            .select('code')
            .eq('shift_id', assignedShiftId ?? '')
            .eq('active', true)
            .maybeSingle()

          if (entry.error) throw new Error(entry.error.message)
          return entry.data?.code ?? null
        },
        { timeout: 20_000 }
      )
      .toBe('on_call')

    await expect(dayCell(page, ctx!.cycle.targetDate).getByText('On Call')).toBeVisible({
      timeout: 10_000,
    })

    await dayCellButton(page, ctx!.cycle.targetDate).click({ position: { x: 18, y: 18 } })
    await expect(shiftEditorDialog(page)).toBeVisible({ timeout: 10_000 })

    const unassignButton = page.getByRole('button', {
      name: `Unassign ${ctx!.therapist.fullName}`,
    })
    await expect(unassignButton).toBeVisible({ timeout: 10_000 })
    await unassignButton.click()

    await expect(assignToggle).toBeVisible({ timeout: 15_000 })
    await expect
      .poll(
        async () => {
          const shift = await ctx!.supabase
            .from('shifts')
            .select('id')
            .eq('cycle_id', ctx!.cycle.id)
            .eq('user_id', ctx!.therapist.id)
            .eq('date', ctx!.cycle.targetDate)
            .eq('shift_type', 'day')
            .maybeSingle()

          if (shift.error) throw new Error(shift.error.message)
          return shift.data?.id ?? null
        },
        { timeout: 20_000 }
      )
      .toBeNull()
  })
})
