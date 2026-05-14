import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { addDays, formatDateKey, randomString } from './helpers/env'
import { loginAsAndGoTo } from './helpers/auth'
import { createScheduleCycle } from './helpers/schedule-cycles'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type StaffOnboardingContext = {
  supabase: SupabaseClient
  therapist: { id: string; email: string; password: string; firstName: string }
  cycleId: string
}

function nextSaturdayKey() {
  const today = new Date()
  const daysUntilSaturday = (6 - today.getDay() + 7) % 7
  return formatDateKey(addDays(today, daysUntilSaturday))
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

    const cycle = await createScheduleCycle(supabase, {
      label: `Onboarding Availability ${randomString('cycle')}`,
      startDate: addDays(new Date(), 21),
      published: false,
    })

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
      cycleId: cycle.id,
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

  test('new therapist sets rotating weekends and hard never-work days during onboarding', async ({
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
    await expect(page.getByRole('heading', { name: 'Pick how you usually work.' })).toBeVisible()
    await expect(page.getByText('Pick your work days on the next step.')).toBeVisible()
    await page.waitForLoadState('networkidle')

    const rotatingWeekendsOption = page.getByRole('button', {
      name: /Weekdays \+ rotating weekends/i,
    })
    await rotatingWeekendsOption.click()
    await expect(rotatingWeekendsOption).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Tap your work days' })).toBeVisible()
    await page.getByRole('button', { name: /^Mon$/ }).click()
    await page.getByRole('button', { name: /^Tue$/ }).click()
    await page.getByRole('button', { name: /^Wed$/ }).click()
    await page.getByRole('button', { name: /^Thu$/ }).click()
    await page.getByRole('button', { name: /^Fri$/ }).click()
    await expect(page.getByText('Too many consecutive days')).toHaveCount(1)
    await expect(
      page.getByRole('complementary').getByText('Too many consecutive days')
    ).toHaveCount(0)
    await expect(page.getByText('Turn off 2 work days in this streak')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fix it for me' })).toHaveCount(0)
    await page.getByRole('button', { name: /^Thu$/ }).click()
    await expect(page.getByText('Too many consecutive days')).toHaveCount(0)
    await page.getByRole('button', { name: /^Tue$/ }).click()

    const anchorDate = nextSaturdayKey()
    await page.getByLabel('First weekend you work').fill(anchorDate)

    const neverWorkGroup = page.getByRole('group', { name: 'Days you never work' })
    await neverWorkGroup.getByLabel('Tue').check()

    await expect(page.getByText('Never: Tue')).toBeVisible()
    await expect(page.getByText('Mon, Wed, Fri + rotating weekends')).toBeVisible()
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible()
    await page.getByLabel('Max consecutive days').selectOption('4')
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible()
    await page.getByRole('button', { name: 'View my schedule' }).click()
    await expect(page).toHaveURL(
      /(?:\/onboarding\?success=setup_complete|\/dashboard(?:\/staff)?\?success=onboarding_complete)/,
      { timeout: 45_000 }
    )
    if (page.url().includes('/onboarding')) {
      await expect(page.getByRole('link', { name: 'View schedule' })).toBeVisible()
    }

    const patternResult = await ctx!.supabase
      .from('work_patterns')
      .select(
        'pattern_type, weekly_weekdays, works_dow, offs_dow, weekend_rule, weekend_anchor_date'
      )
      .eq('therapist_id', ctx!.therapist.id)
      .single()

    expect(patternResult.error).toBeNull()
    expect(patternResult.data).toMatchObject({
      pattern_type: 'weekly_with_weekend_rotation',
      weekly_weekdays: [1, 3, 5],
      offs_dow: [2],
      weekend_rule: 'every_other_weekend',
      weekend_anchor_date: anchorDate,
    })
    expect(patternResult.data?.works_dow).not.toContain(2)

    const profileResult = await ctx!.supabase
      .from('profiles')
      .select('max_consecutive_days, preferred_work_days_mode, staff_onboarding_completed_at')
      .eq('id', ctx!.therapist.id)
      .single()

    expect(profileResult.error).toBeNull()
    expect(profileResult.data?.max_consecutive_days).toBe(4)
    expect(profileResult.data?.preferred_work_days_mode).toBe('no_preference')
    expect(profileResult.data?.staff_onboarding_completed_at).toBeTruthy()
  })
})
