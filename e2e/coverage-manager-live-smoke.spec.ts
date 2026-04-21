import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, getEnv, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type LiveSmokeContext = {
  supabase: SupabaseClient
  manager: { email: string; password: string }
  cycle: { id: string; targetDate: string }
  lead: { id: string }
  supportStaff: { id: string }[]
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
  const createdUserIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    const managerEmail = getEnv('E2E_USER_EMAIL')
    const managerPassword = getEnv('E2E_USER_PASSWORD')
    if (!supabase || !managerEmail || !managerPassword) return

    const cycleStart = addDays(new Date(), -1)
    const cycleEnd = addDays(cycleStart, 13)
    const targetDate = formatDateKey(addDays(cycleStart, 2))
    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Coverage Live Smoke ${randomString('cycle')}`,
        start_date: formatDateKey(cycleStart),
        end_date: formatDateKey(cycleEnd),
        published: true,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data?.id) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create live smoke cycle.')
    }

    const therapistFullName = `Coverage Live ${randomString('ther')}`
    const therapistEmail = `${randomString('coverage-live')}@example.com`
    const therapistPassword = `Ther!${Math.random().toString(16).slice(2, 8)}`
    const therapist = await createE2EUser(supabase, {
      email: therapistEmail,
      password: therapistPassword,
      fullName: therapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
      maxWorkDaysPerWeek: 5,
    })
    createdUserIds.push(therapist.id)

    const lead = await createE2EUser(supabase, {
      email: `${randomString('coverage-lead')}@example.com`,
      password: `Lead!${Math.random().toString(16).slice(2, 8)}`,
      fullName: `Coverage Lead ${randomString('lead')}`,
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
      maxWorkDaysPerWeek: 5,
    })
    createdUserIds.push(lead.id)

    const supportStaff = await Promise.all(
      Array.from({ length: 2 }, async (_, index) => {
        const user = await createE2EUser(supabase, {
          email: `${randomString(`coverage-staff-${index}`)}@example.com`,
          password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
          fullName: `Coverage Staff ${index + 1} ${randomString('staff')}`,
          role: 'therapist',
          employmentType: 'full_time',
          shiftType: 'day',
          isLeadEligible: false,
          maxWorkDaysPerWeek: 5,
        })
        createdUserIds.push(user.id)
        return user
      })
    )

    const seedShifts = await supabase.from('shifts').insert([
      {
        cycle_id: cycleInsert.data.id,
        user_id: lead.id,
        date: targetDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'lead',
      },
      ...supportStaff.map((staff) => ({
        cycle_id: cycleInsert.data.id,
        user_id: staff.id,
        date: targetDate,
        shift_type: 'day' as const,
        status: 'scheduled' as const,
        assignment_status: 'scheduled' as const,
        role: 'staff' as const,
      })),
    ])

    if (seedShifts.error) {
      throw new Error(seedShifts.error.message)
    }

    ctx = {
      supabase,
      manager: { email: managerEmail, password: managerPassword },
      cycle: { id: cycleInsert.data.id, targetDate },
      lead,
      supportStaff,
      therapist: { id: therapist.id, fullName: therapistFullName },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase.from('shifts').delete().eq('cycle_id', ctx.cycle.id)
    await ctx.supabase.from('schedule_cycles').delete().eq('id', ctx.cycle.id)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
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
    await statusPopover.getByRole('button', { name: 'Call In' }).click({ force: true })
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
      .toBe('call_in')

    await expect(dayCell(page, ctx!.cycle.targetDate).getByText('Call In')).toBeVisible({
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
