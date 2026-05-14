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
  activeTherapist: { id: string; fullName: string }
  inactiveTherapist: { id: string; fullName: string }
  cycle: { id: string }
  targetDate: string
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

    const cycle = await createScheduleCycle(supabase, {
      label: randomString('Picker Eligibility Cycle'),
      startDate: addDays(new Date(), 730),
      published: false,
      status: 'draft',
      siteId,
    })
    const startDate = new Date(`${cycle.start_date}T00:00:00`)
    const targetDate = formatDateKey(addDays(startDate, 1))

    ctx = {
      supabase,
      siteId,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      activeTherapist: { id: activeTherapist.id, fullName: activeTherapistFullName },
      inactiveTherapist: { id: inactiveTherapist.id, fullName: inactiveTherapistFullName },
      cycle: { id: cycle.id },
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

  test('inactive therapists are rejected for new manager assignments', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}&view=week&shift=day`)
    await expect(page).toHaveURL(/\/schedule/)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()

    const blockedResponse = await page.evaluate(
      async (payload) => {
        const response = await fetch('/api/schedule/drag-drop', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const body = await response.json().catch(() => null)
        return { status: response.status, body }
      },
      {
        action: 'assign',
        cycleId: ctx!.cycle.id,
        userId: ctx!.inactiveTherapist.id,
        date: ctx!.targetDate,
        shiftType: 'day',
        role: 'staff',
        overrideWeeklyRules: false,
      }
    )
    expect(blockedResponse.status).toBe(409)
    const blockedPayload = blockedResponse.body as { error?: string } | null
    expect(blockedPayload?.error).toMatch(/inactive|cannot be assigned|unavailable/i)
  })
})
