import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, randomString } from './helpers/env'
import { createScheduleCycle } from './helpers/schedule-cycles'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type ControlsCtx = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
}

async function getLatestCycleRange(supabase: SupabaseClient) {
  const result = await supabase
    .from('schedule_cycles')
    .select('id, start_date, end_date')
    .order('end_date', { ascending: false })
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data
}

test.describe.serial('coverage cycle controls', () => {
  test.setTimeout(120_000)

  let ctx: ControlsCtx | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('controls-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 10)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Coverage Controls Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(manager.id)

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase.from('publish_events').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('notification_outbox').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('notifications').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('schedule_cycles').delete().in('id', createdCycleIds)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('manager can open and then delete a draft cycle through schedule and publish history', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run cycle-controls e2e.')

    const label = `Coverage Dialog ${randomString('cycle')}`
    const cycle = await createScheduleCycle(ctx!.supabase, {
      label,
      startDate: addDays(new Date(), 45),
      published: false,
    })
    createdCycleIds.push(cycle.id)

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${cycle.id}&view=week`)
    await expect(page).toHaveURL(/\/schedule\?.*cycle=/)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Schedule Block' })).toHaveValue(cycle.id)

    await page.goto('/publish')
    const cycleRow = page
      .locator('tr')
      .filter({ has: page.getByText(label).first() })
      .first()
    await expect(cycleRow).toBeVisible()
    await cycleRow.getByRole('button', { name: 'Delete draft' }).click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('schedule_cycles')
            .select('id')
            .eq('id', cycle.id)
            .maybeSingle()

          if (result.error) throw new Error(result.error.message)
          return result.data?.id ?? null
        },
        { timeout: 20_000 }
      )
      .toBeNull()
  })

  test('legacy coverage query redirects to schedule with cycle and shift context', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run cycle-controls e2e.')

    const latestCycle = await getLatestCycleRange(ctx!.supabase)
    if (!latestCycle) {
      throw new Error('Expected at least one existing cycle to validate overlap recovery.')
    }

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${latestCycle.id}&view=roster&shift=night`)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/schedule\\?.*cycle=${latestCycle.id}`))
    await expect(page).toHaveURL(/shift=night/)
    await expect(page.getByRole('combobox', { name: 'Schedule Block' })).toHaveValue(latestCycle.id)
  })

  test('manager can auto-draft from the unified schedule grid', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run cycle-controls e2e.')

    const cycleLabel = `Auto Draft ${randomString('cycle')}`
    const cycle = await createScheduleCycle(ctx!.supabase, {
      label: cycleLabel,
      startDate: addDays(new Date(), 21),
      published: false,
    })
    createdCycleIds.push(cycle.id)

    const staffSpecs = [
      { role: 'lead' as const, shiftType: 'day' as const, leadEligible: true },
      { role: 'therapist' as const, shiftType: 'day' as const, leadEligible: false },
      { role: 'therapist' as const, shiftType: 'day' as const, leadEligible: false },
      { role: 'lead' as const, shiftType: 'night' as const, leadEligible: true },
      { role: 'therapist' as const, shiftType: 'night' as const, leadEligible: false },
      { role: 'therapist' as const, shiftType: 'night' as const, leadEligible: false },
    ]

    for (const [index, spec] of staffSpecs.entries()) {
      const user = await createE2EUser(ctx!.supabase, {
        email: `${randomString(`autodraft-${index}`)}@example.com`,
        password: `Staff!${Math.random().toString(16).slice(2, 10)}`,
        fullName: `Auto Draft ${index + 1}`,
        role: spec.role,
        employmentType: 'full_time',
        shiftType: spec.shiftType,
        isLeadEligible: spec.leadEligible,
      })
      createdUserIds.push(user.id)
    }

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${cycle.id}&view=week`)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()

    await page.getByRole('button', { name: 'Auto-draft' }).first().click()

    await expect
      .poll(async () => {
        const result = await ctx!.supabase.from('shifts').select('id').eq('cycle_id', cycle.id)

        if (result.error) throw new Error(result.error.message)
        return (result.data ?? []).length
      })
      .toBeGreaterThan(0)
  })
})
