import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createScheduleCycle } from './helpers/schedule-cycles'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TestContext = {
  supabase: SupabaseClient
  siteId: string
  manager: { id: string; email: string; password: string }
  lead: { id: string }
  therapist: { id: string; fullName: string }
  cycle: { id: string; startDate: string; endDate: string }
  targetDate: string
}

test.describe.serial('post-final direct grid edits', () => {
  test.setTimeout(90_000)

  let ctx: TestContext | null = null
  const createdUserIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const siteId = randomString('post-final-site')
    const siteInsert = await supabase.from('sites').insert({
      id: siteId,
      name: 'Post-final grid edit test site',
    })
    if (siteInsert.error) {
      throw new Error(`Could not create test site: ${siteInsert.error.message}`)
    }

    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const managerEmail = `${randomString('post-final-manager')}@example.com`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'E2E Post Final Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
    })

    const lead = await createE2EUser(supabase, {
      email: `${randomString('post-final-lead')}@example.com`,
      password: `Lead!${Math.random().toString(16).slice(2, 8)}`,
      fullName: 'E2E Post Final Lead',
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const therapistFullName = 'E2E Post Final Therapist'
    const therapist = await createE2EUser(supabase, {
      email: `${randomString('post-final-therapist')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
    })

    createdUserIds.push(manager.id, lead.id, therapist.id)

    const profileSiteUpdate = await supabase
      .from('profiles')
      .update({ site_id: siteId })
      .in('id', createdUserIds)
    if (profileSiteUpdate.error) {
      throw new Error(`Could not move test profiles to site: ${profileSiteUpdate.error.message}`)
    }

    const cycle = await createScheduleCycle(supabase, {
      label: randomString('Post Final Grid Edit Cycle'),
      startDate: addDays(new Date(), 365),
      published: true,
      status: 'final',
      siteId,
    })
    const startDate = new Date(`${cycle.start_date}T00:00:00`)
    const targetDate = formatDateKey(addDays(startDate, 1))

    const leadShiftInsert = await supabase.from('shifts').insert({
      cycle_id: cycle.id,
      site_id: siteId,
      user_id: lead.id,
      date: targetDate,
      shift_type: 'day',
      role: 'lead',
      status: 'scheduled',
    })
    if (leadShiftInsert.error) {
      throw new Error(`Could not seed lead shift: ${leadShiftInsert.error.message}`)
    }

    ctx = {
      supabase,
      siteId,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      lead,
      therapist: { id: therapist.id, fullName: therapistFullName },
      cycle: {
        id: cycle.id,
        startDate: cycle.start_date,
        endDate: cycle.end_date,
      },
      targetDate,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase.from('notifications').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('audit_log').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('shifts').delete().eq('cycle_id', ctx.cycle.id)
    await ctx.supabase.from('schedule_cycles').delete().eq('id', ctx.cycle.id)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
      await ctx.supabase.from('profiles').delete().eq('id', userId)
    }

    await ctx.supabase.from('sites').delete().eq('id', ctx.siteId)
  })

  test('manager adding staff to a final schedule records the change and notifies the therapist', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}&view=week&shift=day`)
    await expect(page).toHaveURL(/\/schedule/)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()

    const mutationResponse = await page.evaluate(
      async (payload) => {
        const response = await fetch('/api/schedule/drag-drop', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const body = await response.json().catch(() => null)
        return { ok: response.ok, status: response.status, body }
      },
      {
        action: 'assign',
        cycleId: ctx!.cycle.id,
        userId: ctx!.therapist.id,
        date: ctx!.targetDate,
        shiftType: 'day',
        role: 'staff',
        overrideWeeklyRules: false,
      }
    )
    expect(
      mutationResponse.ok,
      `drag-drop response ${mutationResponse.status}: ${JSON.stringify(mutationResponse.body)}`
    ).toBe(true)

    const shiftResult = await ctx!.supabase
      .from('shifts')
      .select('id')
      .eq('cycle_id', ctx!.cycle.id)
      .eq('user_id', ctx!.therapist.id)
      .eq('date', ctx!.targetDate)
      .eq('shift_type', 'day')
      .single()
    expect(shiftResult.error).toBeNull()
    expect(shiftResult.data?.id).toBeTruthy()

    const auditResult = await ctx!.supabase
      .from('audit_log')
      .select('id, action, target_type, target_id')
      .eq('user_id', ctx!.manager.id)
      .eq('action', 'post_publish_modification')
      .eq('target_type', 'shift')
      .eq('target_id', shiftResult.data!.id)
      .maybeSingle()
    expect(auditResult.error).toBeNull()
    expect(auditResult.data).toMatchObject({
      action: 'post_publish_modification',
      target_id: shiftResult.data!.id,
    })

    const notificationResult = await ctx!.supabase
      .from('notifications')
      .select('id, event_type, title, message, target_type, target_id')
      .eq('user_id', ctx!.therapist.id)
      .eq('event_type', 'published_schedule_changed')
      .eq('target_type', 'shift')
      .eq('target_id', shiftResult.data!.id)
      .maybeSingle()
    expect(notificationResult.error).toBeNull()
    expect(notificationResult.data).toMatchObject({
      title: 'Published schedule updated',
      target_id: shiftResult.data!.id,
    })
    expect(notificationResult.data?.message).toContain('you were added to a day shift')
  })
})
