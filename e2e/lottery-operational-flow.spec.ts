import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type LotteryFlowCtx = {
  supabase: SupabaseClient
  siteId: string
  manager: { id: string; email: string; password: string }
  cycleId: string
  shiftDate: string
  therapistA: { id: string; name: string }
  therapistB: { id: string; name: string }
  therapistC: { id: string; name: string }
  therapistD: { id: string; name: string }
}

function nextSundayAfter(daysAhead: number): Date {
  const target = addDays(new Date(), daysAhead)
  return addDays(target, (7 - target.getDay()) % 7)
}

test.describe.serial('lottery operational flow', () => {
  test.setTimeout(120_000)

  let ctx: LotteryFlowCtx | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return
    const siteId = randomString('lottery-site')
    const siteInsert = await supabase.from('sites').insert({ id: siteId, name: 'Lottery Ops Site' })
    if (siteInsert.error) throw new Error(siteInsert.error.message)

    const managerEmail = `${randomString('lottery-op-mgr')}@example.com`
    const managerPassword = `Lottery!${Math.random().toString(16).slice(2, 10)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Lottery Ops Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
      siteId,
    })
    createdUserIds.push(manager.id)

    const therapistA = await createE2EUser(supabase, {
      email: `${randomString('lottery-a')}@example.com`,
      password: `Thera!${Math.random().toString(16).slice(2, 10)}`,
      fullName: 'Lottery Therapist A',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      siteId,
    })
    const therapistB = await createE2EUser(supabase, {
      email: `${randomString('lottery-b')}@example.com`,
      password: `Thera!${Math.random().toString(16).slice(2, 10)}`,
      fullName: 'Lottery Therapist B',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      siteId,
    })
    const therapistC = await createE2EUser(supabase, {
      email: `${randomString('lottery-c')}@example.com`,
      password: `Thera!${Math.random().toString(16).slice(2, 10)}`,
      fullName: 'Lottery Therapist C',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      siteId,
    })
    const therapistD = await createE2EUser(supabase, {
      email: `${randomString('lottery-d')}@example.com`,
      password: `Thera!${Math.random().toString(16).slice(2, 10)}`,
      fullName: 'Lottery Therapist D',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      siteId,
    })
    createdUserIds.push(therapistA.id, therapistB.id, therapistC.id, therapistD.id)

    const cycleStart = nextSundayAfter(30 + Math.floor(Math.random() * 45))
    const shiftDate = formatDateKey(addDays(cycleStart, 2))
    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        site_id: siteId,
        label: `Lottery Ops ${randomString('cycle')}`,
        start_date: formatDateKey(cycleStart),
        end_date: formatDateKey(addDays(cycleStart, 41)),
        published: true,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create lottery test cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    const shiftInsert = await supabase.from('shifts').insert([
      {
        site_id: siteId,
        cycle_id: cycleInsert.data.id,
        user_id: therapistA.id,
        date: shiftDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        site_id: siteId,
        cycle_id: cycleInsert.data.id,
        user_id: therapistB.id,
        date: shiftDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        site_id: siteId,
        cycle_id: cycleInsert.data.id,
        user_id: therapistC.id,
        date: shiftDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        site_id: siteId,
        cycle_id: cycleInsert.data.id,
        user_id: therapistD.id,
        date: shiftDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
    ])

    if (shiftInsert.error) {
      throw new Error(shiftInsert.error.message)
    }

    const listInsert = await supabase.from('lottery_list_entries').insert([
      {
        site_id: siteId,
        shift_type: 'day',
        therapist_id: therapistA.id,
        display_order: 1,
        created_by: manager.id,
        updated_by: manager.id,
      },
      {
        site_id: siteId,
        shift_type: 'day',
        therapist_id: therapistB.id,
        display_order: 2,
        created_by: manager.id,
        updated_by: manager.id,
      },
      {
        site_id: siteId,
        shift_type: 'day',
        therapist_id: therapistC.id,
        display_order: 3,
        created_by: manager.id,
        updated_by: manager.id,
      },
      {
        site_id: siteId,
        shift_type: 'day',
        therapist_id: therapistD.id,
        display_order: 4,
        created_by: manager.id,
        updated_by: manager.id,
      },
    ])

    if (listInsert.error) {
      throw new Error(listInsert.error.message)
    }

    ctx = {
      supabase,
      siteId,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      cycleId: cycleInsert.data.id,
      shiftDate,
      therapistA: { id: therapistA.id, name: 'Lottery Therapist A' },
      therapistB: { id: therapistB.id, name: 'Lottery Therapist B' },
      therapistC: { id: therapistC.id, name: 'Lottery Therapist C' },
      therapistD: { id: therapistD.id, name: 'Lottery Therapist D' },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase.from('lottery_history_entries').delete().in('therapist_id', createdUserIds)
    await ctx.supabase.from('audit_log').delete().in('user_id', createdUserIds)

    await ctx.supabase
      .from('lottery_decisions')
      .delete()
      .eq('site_id', ctx.siteId)
      .eq('shift_date', ctx.shiftDate)
      .eq('shift_type', 'day')

    await ctx.supabase.from('lottery_requests').delete().in('therapist_id', createdUserIds)
    await ctx.supabase.from('lottery_list_entries').delete().in('therapist_id', createdUserIds)
    await ctx.supabase.from('publish_events').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('notification_outbox').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('notifications').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('schedule_cycles').delete().in('id', createdCycleIds)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
    await ctx.supabase.from('profiles').delete().in('id', createdUserIds)
    await ctx.supabase.from('sites').delete().eq('id', ctx.siteId)
  })

  test('manager can preview, apply, and audit a lottery result on a published shift', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required for lottery e2e.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/lottery?date=${ctx!.shiftDate}&shift=day`)

    await expect(page.getByRole('heading', { name: 'Lottery' })).toBeVisible()
    await expect(
      page.getByRole('paragraph').filter({ hasText: 'Lottery Therapist A' }).first()
    ).toBeVisible()

    await page.getByLabel('Keep working').fill('3')
    await expect(page.getByRole('button', { name: 'Apply result' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText('On Call', { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    })

    await page.getByRole('button', { name: 'Apply result' }).click()
    await expect(page.getByText(/Last applied/)).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'History' }).first().click()
    await expect(page.getByText('Lottery Therapist A history')).toBeVisible()
    await expect(page.getByText('Recorded')).toBeVisible()
    await expect(page.getByText('On Call', { exact: true }).first()).toBeVisible()

    const auditResult = await ctx!.supabase
      .from('audit_log')
      .select('id, action, target_type, target_id')
      .eq('user_id', ctx!.manager.id)
      .eq('action', 'post_publish_modification')
      .eq('target_type', 'shift')
      .maybeSingle()
    expect(auditResult.error).toBeNull()
    expect(auditResult.data?.target_id).toBeTruthy()
  })
})
