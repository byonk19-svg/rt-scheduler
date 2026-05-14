import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createScheduleCycle } from './helpers/schedule-cycles'
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

    const cycle = await createScheduleCycle(supabase, {
      siteId,
      label: `Lottery Ops ${randomString('cycle')}`,
      startDate: addDays(new Date(), 30 + Math.floor(Math.random() * 45)),
      published: true,
      status: 'final',
    })
    const cycleStart = new Date(`${cycle.start_date}T00:00:00`)
    const shiftDate = formatDateKey(addDays(cycleStart, 2))
    createdCycleIds.push(cycle.id)

    const shiftInsert = await supabase.from('shifts').insert([
      {
        site_id: siteId,
        cycle_id: cycle.id,
        user_id: therapistA.id,
        date: shiftDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        site_id: siteId,
        cycle_id: cycle.id,
        user_id: therapistB.id,
        date: shiftDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        site_id: siteId,
        cycle_id: cycle.id,
        user_id: therapistC.id,
        date: shiftDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        site_id: siteId,
        cycle_id: cycle.id,
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
      cycleId: cycle.id,
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

    await page.goto(`/lottery?date=${ctx!.shiftDate}&shift=day&keepToWork=3`)
    await expect(page.getByLabel('Keep working')).toHaveValue('3')
    await expect(page.getByText(/Loading Lottery data/)).toHaveCount(0, { timeout: 45_000 })
    await expect(page.getByRole('button', { name: 'Apply result' })).toBeVisible({
      timeout: 45_000,
    })
    await expect(page.getByText('On Call', { exact: true }).first()).toBeVisible({
      timeout: 45_000,
    })

    const snapshotResponse = await page.request.get(
      `/api/lottery/snapshot?date=${ctx!.shiftDate}&shift=day&keepToWork=3`
    )
    expect(snapshotResponse.ok()).toBeTruthy()
    const snapshotPayload = (await snapshotResponse.json()) as {
      snapshot?: {
        recommendation?: {
          contextSignature: string
          keepToWork: number
          actions: Array<{ therapistId: string; status: 'cancelled' | 'on_call' }>
        } | null
      }
    }
    const recommendation = snapshotPayload.snapshot?.recommendation
    expect(recommendation?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          therapistId: ctx!.therapistA.id,
          status: 'on_call',
        }),
      ])
    )
    const applyResponse = await page.request.post('/api/lottery/apply', {
      headers: {
        origin: 'http://127.0.0.1:3000',
        referer: `http://127.0.0.1:3000/lottery?date=${ctx!.shiftDate}&shift=day&keepToWork=3`,
      },
      data: {
        shiftDate: ctx!.shiftDate,
        shiftType: 'day',
        keepToWork: recommendation!.keepToWork,
        contextSignature: recommendation!.contextSignature,
        actions: recommendation!.actions,
      },
    })
    expect(applyResponse.ok()).toBeTruthy()

    await expect
      .poll(
        async () => {
          const updatedShift = await ctx!.supabase
            .from('shifts')
            .select('assignment_status, status')
            .eq('cycle_id', ctx!.cycleId)
            .eq('user_id', ctx!.therapistA.id)
            .eq('date', ctx!.shiftDate)
            .eq('shift_type', 'day')
            .maybeSingle()
          if (updatedShift.error) throw new Error(updatedShift.error.message)
          return `${updatedShift.data?.assignment_status ?? ''}:${updatedShift.data?.status ?? ''}`
        },
        { timeout: 45_000 }
      )
      .toBe('on_call:on_call')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Loading Lottery data/)).toHaveCount(0, { timeout: 45_000 })
    await expect(page.getByText('Latest applied decision', { exact: true })).toBeVisible({
      timeout: 45_000,
    })
    await expect(page.getByText('Lottery Therapist A: On Call')).toBeVisible({ timeout: 45_000 })

    await expect
      .poll(
        async () => {
          const historyResult = await ctx!.supabase
            .from('lottery_history_entries')
            .select('id, applied_status, shift_date, shift_type')
            .eq('site_id', ctx!.siteId)
            .eq('therapist_id', ctx!.therapistA.id)
            .eq('shift_date', ctx!.shiftDate)
            .eq('shift_type', 'day')
            .maybeSingle()
          if (historyResult.error) throw new Error(historyResult.error.message)
          return historyResult.data?.applied_status ?? null
        },
        { timeout: 45_000 }
      )
      .toBe('on_call')

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
