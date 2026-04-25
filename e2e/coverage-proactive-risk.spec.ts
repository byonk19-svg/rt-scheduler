import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
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

    const cycleDate = formatDateKey(addDays(new Date(), 28))
    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Coverage Risk ${randomString('cycle')}`,
        start_date: cycleDate,
        end_date: cycleDate,
        published: false,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create proactive-risk cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

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
      cycle_id: cycleInsert.data.id,
      therapist_id: row.id,
      date: cycleDate,
      shift_type: 'both' as const,
      override_type: 'force_off' as const,
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
      cycleId: cycleInsert.data.id,
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
    await page.goto(`/coverage?cycle=${ctx!.cycleId}&view=week`)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()

    await expect(page.getByText('Coverage risk before Auto-draft').first()).toBeVisible()
    await expect(page.getByText(/projected to miss/i).first()).toBeVisible()

    await page.getByRole('button', { name: 'Review pre-flight' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Draft pre-flight report')).toBeVisible()
    await expect(page.getByText('Checking constraints...')).toBeVisible()
  })
})
