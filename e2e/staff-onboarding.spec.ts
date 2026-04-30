import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { addDays, formatDateKey, randomString } from './helpers/env'
import { loginAsAndGoTo } from './helpers/auth'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type StaffOnboardingContext = {
  supabase: SupabaseClient
  therapist: { id: string; email: string; password: string; firstName: string }
  cycleId: string
}

test.describe.serial('staff onboarding gate', () => {
  test.setTimeout(120_000)

  let ctx: StaffOnboardingContext | null = null
  const createdUserIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const firstName = 'Onboarding'
    const fullName = `${firstName} Therapist`
    const therapistEmail = `${randomString('onboard-ther')}@example.com`
    const therapistPassword = `Onb!${Math.random().toString(16).slice(2, 10)}`
    const therapist = await createE2EUser(supabase, {
      email: therapistEmail,
      password: therapistPassword,
      fullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(therapist.id)

    const cycleStart = addDays(new Date(), 21)
    const cycleEnd = addDays(cycleStart, 13)
    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Onboarding Availability ${randomString('cycle')}`,
        start_date: formatDateKey(cycleStart),
        end_date: formatDateKey(cycleEnd),
        published: false,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create onboarding cycle.')
    }

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        staff_onboarding_required: true,
        staff_onboarding_completed_at: null,
        staff_onboarding_preferences_confirmed_at: null,
        staff_onboarding_theme_confirmed_at: null,
        preferred_work_days_mode: 'unset',
        preferred_work_days: [],
        default_landing_page: 'dashboard',
      })
      .eq('id', therapist.id)

    if (profileUpdateError) {
      throw new Error(
        `Could not reset onboarding state for ${therapistEmail}: ${profileUpdateError.message}`
      )
    }

    ctx = {
      supabase,
      therapist: {
        id: therapist.id,
        email: therapistEmail,
        password: therapistPassword,
        firstName,
      },
      cycleId: cycleInsert.data.id,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase.from('work_patterns').delete().eq('therapist_id', ctx.therapist.id)
    await ctx.supabase.from('availability_overrides').delete().eq('cycle_id', ctx.cycleId)
    await ctx.supabase
      .from('therapist_availability_submissions')
      .delete()
      .eq('schedule_cycle_id', ctx.cycleId)
    await ctx.supabase.from('schedule_cycles').delete().eq('id', ctx.cycleId)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('new therapist is routed through onboarding before entering the normal app', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required.')

    await loginAsAndGoTo(
      page,
      ctx!.therapist.email,
      ctx!.therapist.password,
      '/dashboard',
      /\/onboarding(?:[/?].*)?$/
    )
    await expect(page.getByText('Setup your account')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Finish setup' })).toBeDisabled()

    await page.getByRole('link', { name: 'Open step' }).nth(0).click()
    await expect(page).toHaveURL(/\/therapist\/recurring-pattern\?return_to=(?:%2F|\/)onboarding/)
    await page.getByRole('button', { name: /No repeating schedule/i }).click()
    await page.getByRole('button', { name: /Save recurring pattern/i }).click()
    await page.waitForURL(/\/onboarding\?success=work_pattern_saved/, { timeout: 45_000 })

    await expect(page.getByText('Set your normal schedule')).toBeVisible()
    await page
      .getByRole('link', { name: /Open step/i })
      .nth(0)
      .click()
    await expect(page).toHaveURL(
      /\/therapist\/settings\?setup=preferences&return_to=(?:%2F|\/)onboarding/
    )
    await page.getByLabel('No preference').check()
    await page.getByRole('button', { name: /Save settings/i }).click()
    await page.waitForURL(/\/onboarding\?success=settings_saved/, { timeout: 45_000 })

    await page
      .getByRole('link', { name: /Open step/i })
      .nth(0)
      .click()
    await expect(page).toHaveURL(
      /\/therapist\/settings\?setup=notifications&return_to=(?:%2F|\/)onboarding/
    )
    await page.getByRole('button', { name: 'System' }).click()
    await page.getByRole('button', { name: /Save settings/i }).click()
    await page.waitForURL(/\/onboarding\?success=settings_saved/, { timeout: 45_000 })

    await expect(page.getByText('Review Future Availability')).toBeVisible()
    await expect(
      page.getByText('This is recommended next, but you can finish setup without it.')
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Finish setup' })).toBeEnabled()

    await page.getByRole('button', { name: 'Finish setup' }).click()
    await expect(page).toHaveURL(/\/dashboard(?:\/staff)?\?success=onboarding_complete/, {
      timeout: 45_000,
    })
    await expect(page.getByRole('heading', { name: /Welcome, Onboarding/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Future Availability' })).toBeVisible()
  })
})
