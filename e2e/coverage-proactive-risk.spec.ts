import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, randomString } from './helpers/env'
import { gotoWithRetry } from './helpers/navigation'
import { createScheduleCycle } from './helpers/schedule-cycles'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type ProactiveRiskCtx = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  cycleId: string
  cycleDate: string
}

test.describe.serial('coverage proactive risk warning', () => {
  test.setTimeout(120_000)

  let ctx: ProactiveRiskCtx | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('risk-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 10)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Coverage Risk Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(manager.id)

    const cycle = await createScheduleCycle(supabase, {
      label: `Coverage Risk ${randomString('cycle')}`,
      startDate: addDays(new Date(), 28),
      published: false,
    })
    const cycleDate = cycle.start_date
    createdCycleIds.push(cycle.id)

    const therapistResult = await supabase
      .from('profiles')
      .select('id')
      .eq('is_active', true)
      .eq('on_fmla', false)
      .in('role', ['therapist', 'lead'])

    if (therapistResult.error) {
      throw new Error(therapistResult.error.message)
    }

    const overrideRows = (therapistResult.data ?? []).map((row) => ({
      cycle_id: cycle.id,
      therapist_id: row.id,
      date: cycleDate,
      shift_type: 'both' as const,
      override_type: 'force_off' as const,
      intent: 'manager_block' as const,
      created_by: manager.id,
      source: 'manager' as const,
      note: 'e2e proactive-risk coverage guard',
    }))

    if (overrideRows.length > 0) {
      const overrideInsert = await supabase.from('availability_overrides').insert(overrideRows)
      if (overrideInsert.error) {
        throw new Error(overrideInsert.error.message)
      }
    }

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      cycleId: cycle.id,
      cycleDate,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase.from('availability_overrides').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('publish_events').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('notification_outbox').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('notifications').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('schedule_cycles').delete().in('id', createdCycleIds)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('shows the manager warning before auto-draft and opens pre-flight details', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run proactive-risk e2e.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await gotoWithRetry(page, `/coverage?cycle=${ctx!.cycleId}&view=week`)
    await expect(page).toHaveURL(/\/schedule\?.*cycle=/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined)

    await page.getByRole('button', { name: 'Pre-flight' }).click()
    await expect(page.getByText('Pre-flight summary')).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByText(
        /\d+ unfilled assignments,\s+\d+ missing lead slots,\s+\d+ need-to-work misses,\s+\d+ missing availability submissions,\s+\d+ open Shift Board requests\./
      )
    ).toBeVisible({ timeout: 15_000 })
  })
})
