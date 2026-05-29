import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { randomString } from './helpers/env'
import { gotoWithRetry } from './helpers/navigation'
import { createScheduleCycle } from './helpers/schedule-cycles'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TestContext = {
  supabase: SupabaseClient
  siteId: string
  manager: { id: string; email: string; password: string }
  therapist: { id: string; email: string; password: string }
  currentPublishedCycle: { id: string; label: string; startDate: string; endDate: string }
  hiddenCycle: { id: string; label: string; startDate: string; endDate: string }
}

test.describe.serial('/schedule/planning Schedule Block Planning', () => {
  test.setTimeout(90_000)

  let ctx: TestContext | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const siteId = randomString('planning-site')
    const siteInsert = await supabase
      .from('sites')
      .insert({ id: siteId, name: 'Planning E2E Site' })
    if (siteInsert.error) throw new Error(siteInsert.error.message)

    const managerEmail = `${randomString('planning-manager')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'E2E Planning Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      siteId,
      isLeadEligible: true,
    })

    const therapistEmail = `${randomString('planning-therapist')}@example.com`
    const therapistPassword = `Ther!${Math.random().toString(16).slice(2, 8)}`
    const therapist = await createE2EUser(supabase, {
      email: therapistEmail,
      password: therapistPassword,
      fullName: 'E2E Planning Therapist',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      siteId,
      isLeadEligible: false,
    })

    const currentPublishedLabel = `Published Planning ${randomString('cycle')}`
    const currentPublishedCycle = await createScheduleCycle(supabase, {
      label: currentPublishedLabel,
      siteId,
      startDate: new Date(),
      align: 'on-or-before',
      published: true,
    })

    const hiddenLabel = `Hidden Planning ${randomString('cycle')}`
    const hiddenCycle = await createScheduleCycle(supabase, {
      label: hiddenLabel,
      siteId,
      startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180),
    })

    createdUserIds.push(manager.id, therapist.id)
    createdCycleIds.push(currentPublishedCycle.id, hiddenCycle.id)
    ctx = {
      supabase,
      siteId,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      therapist: { id: therapist.id, email: therapistEmail, password: therapistPassword },
      currentPublishedCycle: {
        id: currentPublishedCycle.id,
        label: currentPublishedLabel,
        startDate: currentPublishedCycle.start_date,
        endDate: currentPublishedCycle.end_date,
      },
      hiddenCycle: {
        id: hiddenCycle.id,
        label: hiddenLabel,
        startDate: hiddenCycle.start_date,
        endDate: hiddenCycle.end_date,
      },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return
    await ctx.supabase.from('notifications').delete().in('target_id', createdCycleIds)
    await ctx.supabase.from('availability_overrides').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase
      .from('therapist_availability_submissions')
      .delete()
      .in('schedule_cycle_id', createdCycleIds)
    await ctx.supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('schedule_cycles').delete().in('id', createdCycleIds)
    await ctx.supabase.from('profiles').delete().in('id', createdUserIds)
    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
    await ctx.supabase.from('sites').delete().eq('id', ctx.siteId)
  })

  test('manager plans the next block and therapists only see blocks with a due date', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await gotoWithRetry(page, '/schedule/planning')

    await expect(page.getByRole('heading', { name: 'Schedule Block Planning' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText('Future blocks', { exact: true })).toBeVisible()
    await expect(page.getByText('1 future block needs planning')).toBeVisible()

    const upcomingSection = page.locator('section[aria-labelledby="upcoming-schedule-blocks"]')
    const contextSection = page.locator('section[aria-labelledby="current-recent-context"]')
    await expect(upcomingSection.getByText(ctx!.hiddenCycle.label)).toBeVisible()
    await expect(upcomingSection.getByText('Needs dates', { exact: true })).toBeVisible()
    await expect(upcomingSection.getByText('Draft', { exact: true })).toBeVisible()
    await expect(upcomingSection.getByText(ctx!.currentPublishedCycle.label)).toHaveCount(0)
    await expect(contextSection.getByText(ctx!.currentPublishedCycle.label)).toBeVisible()
    await expect(contextSection.getByText('Published', { exact: true })).toBeVisible()
    await expect(contextSection.getByText('Missing historical targets')).toBeVisible()

    await page.getByRole('button', { name: 'Create schedule block' }).click()
    await expect(page.getByText('Schedule Block Planning saved.')).toBeVisible({
      timeout: 20_000,
    })

    const createdResult = await ctx!.supabase
      .from('schedule_cycles')
      .select(
        'id, label, start_date, end_date, availability_due_at, preliminary_target_date, final_publish_target_date'
      )
      .eq('site_id', ctx!.siteId)
      .gt('start_date', ctx!.hiddenCycle.endDate)
      .order('start_date', { ascending: true })
      .limit(1)
      .single()

    if (createdResult.error || !createdResult.data) {
      throw new Error(`Could not read planned Schedule Block: ${createdResult.error?.message}`)
    }

    createdCycleIds.push(createdResult.data.id)
    expect(createdResult.data.availability_due_at).toBeTruthy()
    expect(createdResult.data.preliminary_target_date).toBeTruthy()
    expect(createdResult.data.final_publish_target_date).toBeTruthy()

    await page.context().clearCookies()
    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await gotoWithRetry(page, '/therapist/availability')

    const scheduleBlockSelect = page.getByRole('combobox', { name: 'Schedule Block' })
    await expect(
      scheduleBlockSelect.locator(`option[value="${createdResult.data.id}"]`)
    ).toHaveCount(1, {
      timeout: 20_000,
    })
    await expect(scheduleBlockSelect.locator(`option[value="${ctx!.hiddenCycle.id}"]`)).toHaveCount(
      0
    )
    await gotoWithRetry(page, `/therapist/availability?cycle=${createdResult.data.id}`)
    await expect(page.getByText(`Schedule Block: ${createdResult.data.label}`)).toBeVisible({
      timeout: 20_000,
    })
  })
})
