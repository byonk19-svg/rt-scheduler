import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, randomString } from './helpers/env'
import { createScheduleCycle } from './helpers/schedule-cycles'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type StaffDashboardCtx = {
  supabase: SupabaseClient
  therapist: { id: string; email: string; password: string }
  cycleId: string
}

test.describe.serial('staff dashboard smoke', () => {
  test.setTimeout(120_000)
  let ctx: StaffDashboardCtx | null = null
  let createdCycleId: string | null = null
  let createdUserId: string | null = null

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const therapistEmail = `${randomString('staff-dash')}@example.com`
    const therapistPassword = `Ther!${Math.random().toString(16).slice(2, 8)}`
    const therapist = await createE2EUser(supabase, {
      email: therapistEmail,
      password: therapistPassword,
      fullName: 'Dashboard Therapist',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserId = therapist.id

    const cycle = await createScheduleCycle(supabase, {
      label: `Dashboard Smoke ${randomString('cycle')}`,
      startDate: addDays(new Date(), 14),
      published: false,
      availabilityDueAt: addDays(new Date(), 1).toISOString(),
    })

    createdCycleId = cycle.id
    ctx = {
      supabase,
      therapist: {
        id: therapist.id,
        email: therapistEmail,
        password: therapistPassword,
      },
      cycleId: cycle.id,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    if (createdCycleId) {
      await ctx.supabase
        .from('therapist_availability_submissions')
        .delete()
        .eq('schedule_cycle_id', createdCycleId)
      await ctx.supabase.from('availability_overrides').delete().eq('cycle_id', createdCycleId)
      await ctx.supabase.from('schedule_cycles').delete().eq('id', createdCycleId)
    }

    if (createdUserId) {
      await ctx.supabase.auth.admin.deleteUser(createdUserId)
    }
  })

  test('shows a clear next step with due state and calmer secondary links', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await page.goto('/dashboard/staff', { waitUntil: 'domcontentloaded' })

    const nextStepCard = page
      .locator('article')
      .filter({ has: page.getByText('What needs your attention now') })
      .first()
    await expect(nextStepCard).toBeVisible()

    const nextStepHeading = nextStepCard.getByRole('heading', { level: 2 })
    await expect(nextStepHeading).toHaveText(
      /tell us when you can work|finish and send your availability|availability is past due|availability sent|review preliminary schedule|final schedule ready|schedule closed/i
    )

    const primaryLinks = nextStepCard.locator('a').filter({ hasNotText: 'View schedule' })
    await expect(primaryLinks.first()).toBeVisible()
    await expect(page.getByText('Need something else?')).toBeVisible()
    await expect(page.getByRole('link', { name: 'View schedule' }).first()).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Trade & Coverage Requests' }).first()
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'View history' }).first()).toBeVisible()
  })
})
