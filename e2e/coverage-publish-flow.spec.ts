import { expect, test, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type PublishFlowCtx = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  cycleId: string
}

async function submitPublishForm(page: Page, buttonName: string) {
  const button = page.getByRole('button', { name: buttonName }).first()
  await expect(button).toBeVisible()
  await button.click()
}

test.describe.serial('coverage publish flow', () => {
  test.setTimeout(120_000)

  let ctx: PublishFlowCtx | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('pub-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 10)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Coverage Publish Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(manager.id)

    const cycleStart = addDays(new Date(), 14)
    const cycleDate = formatDateKey(cycleStart)
    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Publish Coverage ${randomString('cycle')}`,
        start_date: cycleDate,
        end_date: cycleDate,
        published: false,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create publish test cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    // Seed a publishable one-day draft with both day and night coverage, while still
    // triggering the weekly-validation override path because the broader dataset includes
    // many active therapists outside this cycle.
    const dayLead = await createE2EUser(supabase, {
      email: `${randomString('pub-day-lead')}@example.com`,
      password: `Lead!${Math.random().toString(16).slice(2, 10)}`,
      fullName: `Publish Lead ${randomString('staff')}`,
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(dayLead.id)

    const dayStaffOne = await createE2EUser(supabase, {
      email: `${randomString('pub-day-one')}@example.com`,
      password: `Staff!${Math.random().toString(16).slice(2, 10)}`,
      fullName: `Publish Staff One ${randomString('staff')}`,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(dayStaffOne.id)

    const dayStaffTwo = await createE2EUser(supabase, {
      email: `${randomString('pub-day-two')}@example.com`,
      password: `Staff!${Math.random().toString(16).slice(2, 10)}`,
      fullName: `Publish Staff Two ${randomString('staff')}`,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(dayStaffTwo.id)

    const nightLead = await createE2EUser(supabase, {
      email: `${randomString('pub-night-lead')}@example.com`,
      password: `Lead!${Math.random().toString(16).slice(2, 10)}`,
      fullName: `Publish Night Lead ${randomString('staff')}`,
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'night',
      isLeadEligible: true,
    })
    createdUserIds.push(nightLead.id)

    const nightStaffOne = await createE2EUser(supabase, {
      email: `${randomString('pub-night-one')}@example.com`,
      password: `Staff!${Math.random().toString(16).slice(2, 10)}`,
      fullName: `Publish Night One ${randomString('staff')}`,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'night',
      isLeadEligible: false,
    })
    createdUserIds.push(nightStaffOne.id)

    const nightStaffTwo = await createE2EUser(supabase, {
      email: `${randomString('pub-night-two')}@example.com`,
      password: `Staff!${Math.random().toString(16).slice(2, 10)}`,
      fullName: `Publish Night Two ${randomString('staff')}`,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'night',
      isLeadEligible: false,
    })
    createdUserIds.push(nightStaffTwo.id)

    const shiftsInsert = await supabase.from('shifts').insert([
      {
        cycle_id: cycleInsert.data.id,
        user_id: dayLead.id,
        date: cycleDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'lead',
      },
      {
        cycle_id: cycleInsert.data.id,
        user_id: dayStaffOne.id,
        date: cycleDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        cycle_id: cycleInsert.data.id,
        user_id: dayStaffTwo.id,
        date: cycleDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        cycle_id: cycleInsert.data.id,
        user_id: nightLead.id,
        date: cycleDate,
        shift_type: 'night',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'lead',
      },
      {
        cycle_id: cycleInsert.data.id,
        user_id: nightStaffOne.id,
        date: cycleDate,
        shift_type: 'night',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        cycle_id: cycleInsert.data.id,
        user_id: nightStaffTwo.id,
        date: cycleDate,
        shift_type: 'night',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
    ])

    if (shiftsInsert.error) {
      throw new Error(shiftsInsert.error.message)
    }

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      cycleId: cycleInsert.data.id,
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

  test('manager can publish from the coverage override form', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run publish flow e2e.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycleId}&view=week`)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    const requests: Array<{ url: string; method: string; postData?: string | null }> = []
    const responses: Array<{ url: string; status: number }> = []
    const failures: Array<{ url: string; failure: string | null }> = []
    page.on('request', (request) => {
      requests.push({ url: request.url(), method: request.method(), postData: request.postData() })
    })
    page.on('response', (response) => {
      responses.push({ url: response.url(), status: response.status() })
    })
    page.on('requestfailed', (request) => {
      failures.push({ url: request.url(), failure: request.failure()?.errorText ?? null })
    })
    await submitPublishForm(page, 'Publish')

    await expect.poll(async () => requests.some((request) => request.method === 'POST')).toBe(true)

    const overrideButton = page.getByRole('button', { name: 'Publish with weekly override' })
    const cyclePublished = async () => {
      const cycle = await ctx!.supabase
        .from('schedule_cycles')
        .select('published')
        .eq('id', ctx!.cycleId)
        .maybeSingle()

      if (cycle.error) throw new Error(cycle.error.message)
      return cycle.data?.published === true
    }

    if (!(await cyclePublished())) {
      await expect(overrideButton).toBeVisible({ timeout: 15_000 })
      await submitPublishForm(page, 'Publish with weekly override')
    }

    await expect
      .poll(
        async () => {
          return await cyclePublished()
        },
        {
          timeout: 60_000,
          message: `url=${page.url()} requests=${JSON.stringify(requests)} responses=${JSON.stringify(responses)} failures=${JSON.stringify(failures)}`,
        }
      )
      .toBe(true)

    await page.reload()
    await expect(page.getByText(/Published/i).first()).toBeVisible({ timeout: 20_000 })
  })
})
