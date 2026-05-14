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
  therapist: { id: string; email: string; password: string; fullName: string }
  cycle: { id: string; startDate: string; targetDate: string }
}

test.describe.serial('Need Off schedule markers', () => {
  test.setTimeout(90_000)

  let ctx: TestContext | null = null
  const createdUserIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const siteId = randomString('need-off-site')
    const siteInsert = await supabase.from('sites').insert({
      id: siteId,
      name: 'Need Off marker test site',
    })
    if (siteInsert.error) {
      throw new Error(`Could not create test site: ${siteInsert.error.message}`)
    }

    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const managerEmail = `${randomString('need-off-manager')}@example.com`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'E2E Need Off Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
    })

    const therapistPassword = `Ther!${Math.random().toString(16).slice(2, 8)}`
    const therapistEmail = `${randomString('need-off-therapist')}@example.com`
    const therapistFullName = 'E2E Need Off Therapist'
    const therapist = await createE2EUser(supabase, {
      email: therapistEmail,
      password: therapistPassword,
      fullName: therapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
    })

    createdUserIds.push(manager.id, therapist.id)

    const profileUpdate = await supabase
      .from('profiles')
      .update({ site_id: siteId })
      .in('id', createdUserIds)
    if (profileUpdate.error) {
      throw new Error(`Could not move test profiles to site: ${profileUpdate.error.message}`)
    }

    const cycle = await createScheduleCycle(supabase, {
      label: randomString('Need Off Marker Cycle'),
      startDate: addDays(new Date(), 1095),
      published: true,
      status: 'final',
      siteId,
    })
    const startDate = new Date(`${cycle.start_date}T00:00:00`)
    const targetDate = formatDateKey(addDays(startDate, 1))

    const now = new Date().toISOString()
    const availabilityInsert = await supabase.from('availability_overrides').insert({
      therapist_id: therapist.id,
      cycle_id: cycle.id,
      date: targetDate,
      shift_type: 'both',
      override_type: 'force_off',
      intent: 'therapist_need_off',
      source: 'therapist',
      note: 'Need Off browser proof',
      created_by: therapist.id,
    })
    if (availabilityInsert.error) {
      throw new Error(`Could not seed Need Off override: ${availabilityInsert.error.message}`)
    }

    const submissionInsert = await supabase.from('therapist_availability_submissions').insert({
      therapist_id: therapist.id,
      schedule_cycle_id: cycle.id,
      submitted_at: now,
      last_edited_at: now,
    })
    if (submissionInsert.error) {
      throw new Error(`Could not seed availability submission: ${submissionInsert.error.message}`)
    }

    ctx = {
      supabase,
      siteId,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      therapist: {
        id: therapist.id,
        email: therapistEmail,
        password: therapistPassword,
        fullName: therapistFullName,
      },
      cycle: {
        id: cycle.id,
        startDate: cycle.start_date,
        targetDate,
      },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase
      .from('therapist_availability_submissions')
      .delete()
      .eq('schedule_cycle_id', ctx.cycle.id)
    await ctx.supabase.from('availability_overrides').delete().eq('cycle_id', ctx.cycle.id)
    await ctx.supabase.from('shifts').delete().eq('cycle_id', ctx.cycle.id)
    await ctx.supabase.from('schedule_cycles').delete().eq('id', ctx.cycle.id)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
      await ctx.supabase.from('profiles').delete().eq('id', userId)
    }

    await ctx.supabase.from('sites').delete().eq('id', ctx.siteId)
  })

  test('manager roster and therapist My Shifts show submitted Need Off markers', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/schedule?cycle=${ctx!.cycle.id}`)
    const rosterRow = page
      .locator('tr', { hasText: ctx!.therapist.fullName })
      .filter({ hasText: '*' })
      .first()
    await expect(rosterRow).toBeVisible()
    await expect(rosterRow.getByText('*')).toHaveCount(1)

    await page.context().clearCookies()
    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await page.goto(`/schedule?cycle=${ctx!.cycle.id}`)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await expect(page.getByRole('rowheader').filter({ hasText: 'You' })).toBeVisible()
  })
})
