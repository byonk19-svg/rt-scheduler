import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TestContext = {
  supabase: SupabaseClient
  siteId: string
  manager: { id: string; email: string; password: string }
  activeTherapist: { id: string; fullName: string }
  inactiveTherapist: { id: string; fullName: string }
  cycle: { id: string }
  targetDate: string
}

function nextSundayAfter(date: Date): Date {
  const next = new Date(date)
  const daysUntilSunday = (7 - next.getDay()) % 7
  next.setDate(next.getDate() + daysUntilSunday)
  return next
}

test.describe.serial('manager assignment picker eligibility', () => {
  test.setTimeout(90_000)

  let ctx: TestContext | null = null
  const createdUserIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const siteId = randomString('picker-site')
    const siteInsert = await supabase.from('sites').insert({
      id: siteId,
      name: 'Picker eligibility test site',
    })
    if (siteInsert.error) {
      throw new Error(`Could not create test site: ${siteInsert.error.message}`)
    }

    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const managerEmail = `${randomString('picker-manager')}@example.com`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'E2E Picker Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
    })

    const activeTherapistFullName = 'E2E Active Picker Therapist'
    const activeTherapist = await createE2EUser(supabase, {
      email: `${randomString('picker-active')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: activeTherapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
    })

    const inactiveTherapistFullName = 'E2E Inactive Picker Therapist'
    const inactiveTherapist = await createE2EUser(supabase, {
      email: `${randomString('picker-inactive')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: inactiveTherapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
    })

    createdUserIds.push(manager.id, activeTherapist.id, inactiveTherapist.id)

    const profileUpdate = await supabase
      .from('profiles')
      .update({ site_id: siteId })
      .in('id', createdUserIds)
    if (profileUpdate.error) {
      throw new Error(`Could not move test profiles to site: ${profileUpdate.error.message}`)
    }

    const inactiveUpdate = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', inactiveTherapist.id)
    if (inactiveUpdate.error) {
      throw new Error(`Could not mark therapist inactive: ${inactiveUpdate.error.message}`)
    }

    const startDate = nextSundayAfter(addDays(new Date(), 730))
    const endDate = addDays(startDate, 41)
    const targetDate = formatDateKey(addDays(startDate, 1))
    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: randomString('Picker Eligibility Cycle'),
        start_date: formatDateKey(startDate),
        end_date: formatDateKey(endDate),
        published: false,
        status: 'draft',
        site_id: siteId,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(
        `Could not create picker eligibility cycle: ${cycleInsert.error?.message ?? 'unknown'}`
      )
    }

    ctx = {
      supabase,
      siteId,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      activeTherapist: { id: activeTherapist.id, fullName: activeTherapistFullName },
      inactiveTherapist: { id: inactiveTherapist.id, fullName: inactiveTherapistFullName },
      cycle: { id: cycleInsert.data.id },
      targetDate,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase.from('shifts').delete().eq('cycle_id', ctx.cycle.id)
    await ctx.supabase.from('schedule_cycles').delete().eq('id', ctx.cycle.id)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
      await ctx.supabase.from('profiles').delete().eq('id', userId)
    }

    await ctx.supabase.from('sites').delete().eq('id', ctx.siteId)
  })

  test('inactive therapists are not offered for new manager assignments', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}&view=week&shift=day`)

    await page
      .locator(`[data-testid="coverage-day-cell-button-${ctx!.targetDate}"]:visible`)
      .click()
    const shiftDialog = page.getByTestId('coverage-shift-editor-dialog')
    await expect(shiftDialog).toBeVisible()

    await shiftDialog.getByRole('button', { name: /add therapist/i }).click()
    await expect(
      shiftDialog.getByTestId(`coverage-picker-row-${ctx!.activeTherapist.id}-staff`)
    ).toBeVisible()
    await expect(
      shiftDialog.getByTestId(`coverage-picker-row-${ctx!.inactiveTherapist.id}-staff`)
    ).toHaveCount(0)
    await expect(shiftDialog.getByText(ctx!.inactiveTherapist.fullName)).toHaveCount(0)
  })
})
