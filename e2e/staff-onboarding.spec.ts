import { expect, test, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { addDays, formatDateKey, randomString } from './helpers/env'
import { loginAsAndGoTo } from './helpers/auth'
import { createScheduleCycle } from './helpers/schedule-cycles'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type StaffOnboardingContext = {
  supabase: SupabaseClient
  therapist: { id: string; email: string; password: string; firstName: string }
  flexibleTherapist: { id: string; email: string; password: string; firstName: string }
  cycleId: string
}

function nextSaturdayKey() {
  const today = new Date()
  const offset = (6 - today.getDay() + 7) % 7
  return formatDateKey(addDays(today, offset))
}

function nextWeekendRangeLabel() {
  const saturday = new Date(`${nextSaturdayKey()}T00:00:00`)
  const sunday = addDays(saturday, 1)
  const saturdayMonth = saturday.toLocaleDateString('en-US', { month: 'short' })
  const sundayMonth = sunday.toLocaleDateString('en-US', { month: 'short' })
  const saturdayDay = saturday.getDate()
  const sundayDay = sunday.getDate()

  if (saturdayMonth === sundayMonth) return `${saturdayMonth} ${saturdayDay}-${sundayDay}`
  return `${saturdayMonth} ${saturdayDay}-${sundayMonth} ${sundayDay}`
}

async function expectConfirmRow(page: Page, label: string, value: string) {
  const row = page.getByTestId(`confirm-row-${label.toLowerCase().replace(/\s+/g, '-')}`)
  await expect(row).toContainText(label)
  await expect(row.getByText(value, { exact: true })).toBeVisible()
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
    const flexibleTherapistEmail = `${randomString('onboard-flex')}@example.com`
    const flexibleTherapistPassword = `Onb!${Math.random().toString(16).slice(2, 10)}`
    const flexibleTherapist = await createE2EUser(supabase, {
      email: flexibleTherapistEmail,
      password: flexibleTherapistPassword,
      fullName: 'Flexible Weekday Therapist',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(flexibleTherapist.id)

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
      .in('id', [therapist.id, flexibleTherapist.id])

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
      flexibleTherapist: {
        id: flexibleTherapist.id,
        email: flexibleTherapistEmail,
        password: flexibleTherapistPassword,
        firstName: 'Flexible',
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

  test('new therapist can cancel exit setup and then leave onboarding', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')

    await loginAsAndGoTo(
      page,
      ctx!.therapist.email,
      ctx!.therapist.password,
      '/dashboard',
      /\/onboarding(?:[/?].*)?$/
    )
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Exit setup' }).click()
    const dialog = page.getByRole('dialog', { name: 'Leave setup?' })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText('Your setup is not saved yet. You can come back later to finish.')
    ).toBeVisible()

    await dialog.getByRole('button', { name: 'Keep setting up' }).click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/onboarding(?:[/?].*)?$/)

    await page.getByRole('button', { name: 'Exit setup' }).click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Exit setup' }).click()
    await expect(page).toHaveURL(/\/login(?:[/?].*)?$/)
    await page.waitForTimeout(500)
    await expect(page).not.toHaveURL(/\/onboarding(?:[/?].*)?$/)
  })

  test('new therapist can understand the custom repeating pattern builder', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')

    await loginAsAndGoTo(
      page,
      ctx!.therapist.email,
      ctx!.therapist.password,
      '/dashboard',
      /\/onboarding(?:[/?].*)?$/
    )
    await page.waitForLoadState('networkidle')

    const customPatternOption = page.getByRole('button', { name: /Custom repeating pattern/i })
    await customPatternOption.click()
    await expect(customPatternOption).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(
      page.getByRole('heading', { name: 'Build your repeating work/off pattern' })
    ).toBeVisible()
    await expect(page.getByText('Pattern starts on')).toBeVisible()
    await expect(page.getByLabel('Pattern starts on')).toHaveValue(formatDateKey(new Date()))
    await expect(page.getByText('Day 1:')).toContainText(
      new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    )

    await expect(page.getByRole('button', { name: /3 on \/ 3 off/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByRole('button', { name: /4 on \/ 4 off/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await expect(page.getByText('Too many consecutive days')).toHaveCount(0)
    await expect(page.getByText('6-day pattern')).toBeVisible()
    await expect(page.getByText('3 work')).toBeVisible()
    await expect(page.getByText('3 off', { exact: true })).toBeVisible()
    await expect(page.getByText('Longest streak:')).toBeVisible()
    await expect(page.getByText('Pattern: 3 on')).toBeVisible()
    await expect(page.getByText('Advanced: days you are never available')).toBeVisible()
    await expect(page.locator('details')).not.toHaveAttribute('open')

    await page.getByRole('button', { name: /4 on \/ 4 off/i }).click()
    await expect(page.getByRole('button', { name: /4 on \/ 4 off/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByText('This pattern needs a 4-day max streak.')).toBeVisible()
    await expect(page.getByText('You can change the max streak in Preferences next')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()
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
    await expect(
      page.getByRole('heading', { name: 'What kind of schedule do you usually follow?' })
    ).toBeVisible()
    await expect(
      page.getByText(
        'This helps Teamwise build a starting pattern. You can still adjust individual days later.'
      )
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
    await expect(page.getByRole('complementary').getByText('Same days weekly')).toBeVisible()
    await expect(
      page.getByRole('complementary').getByText("Next, you'll choose your normal work days.")
    ).toHaveCount(0)
    await expect(
      page.getByRole('complementary').getByText('Choose your normal work days.', { exact: true })
    ).toBeVisible()
    await expect(page.getByRole('complementary').getByText('PICK YOUR WORK DAYS')).toHaveCount(0)
    await page.waitForLoadState('networkidle')

    const rotatingWeekendsOption = page.getByRole('button', { name: /Rotating weekends/i })
    await rotatingWeekendsOption.click()
    await expect(rotatingWeekendsOption).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Choose your weekend rotation' })).toBeVisible()
    await expect(page.getByText('My weekdays are usually the same')).toBeVisible()
    await expect(page.getByText('My weekdays vary')).toBeVisible()
    await expect(page.getByText('Weekends are set by your rotation below.')).toBeVisible()
    await page.getByRole('button', { name: /^Mon\s+Off/ }).click()
    await page.getByRole('button', { name: /^Tue\s+Off/ }).click()
    await page.getByRole('button', { name: /^Wed\s+Off/ }).click()
    await page.getByRole('button', { name: /^Thu\s+Off/ }).click()
    await page.getByRole('button', { name: /^Fri\s+Off/ }).click()
    await expect(page.getByText('Too many consecutive days')).toHaveCount(1)
    await expect(
      page.getByRole('complementary').getByText('Too many consecutive days')
    ).toHaveCount(0)
    await expect(page.getByText('Turn off 2 work days in this streak')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fix it for me' })).toHaveCount(0)
    await page.getByRole('button', { name: /^Thu\s+Work/ }).click()
    await expect(page.getByText('Too many consecutive days')).toHaveCount(0)
    await page.getByRole('button', { name: /^Tue\s+Work/ }).click()

    await expect(page.getByText('Choose the first working weekend.', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('complementary').getByText('Weekend rotation not set yet.')
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
    const weekendGroup = page.getByRole('group', { name: 'First working weekend' })
    await expect(weekendGroup.getByRole('button').first()).toContainText('Starts rotation')
    await weekendGroup.getByRole('button').first().click()
    await expect(weekendGroup.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Weeks are shown Sunday-Saturday.')).toBeVisible()
    await expect(
      page.getByRole('complementary').locator('[aria-label^="Week 1"]').first()
    ).toHaveAttribute('aria-label', 'Week 1 Sun Off')
    await expect(page.locator('[aria-label="Week 1 Sat Work"]')).toBeVisible()
    await expect(page.locator('[aria-label="Week 2 Sun Work"]')).toBeVisible()
    await expect(page.locator('[aria-label="Week 2 Sat Off"]')).toBeVisible()
    await expect(page.getByRole('complementary').getByText('First working weekend:')).toBeVisible()

    await page.getByText('Advanced: days you are never available').click()
    const neverWorkGroup = page.getByRole('group', {
      name: /Days you are never available/i,
    })
    await neverWorkGroup.getByLabel('Tue').check()

    await expect(page.getByText('Never: Tue')).toBeVisible()
    await expect(page.getByText('Mon, Wed, Fri + rotating weekends')).toBeVisible()
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible()
    await page.getByLabel('Maximum days in a row').selectOption('4')
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Does this look right?' })).toBeVisible()
    await expectConfirmRow(page, 'Schedule type', 'Rotating weekends')
    await expectConfirmRow(page, 'Fixed weekdays', 'Mon, Wed, Fri')
    await expectConfirmRow(page, 'Weekend rotation', 'Every other weekend')
    await expectConfirmRow(page, 'First working weekend', nextWeekendRangeLabel())
    await expectConfirmRow(page, 'Maximum days in a row', '4 days')
    await expectConfirmRow(page, 'Preferred work days', 'Any day')
    await expectConfirmRow(page, 'Never available', 'Tue')
    await page.getByRole('button', { name: 'Save and view my schedule' }).click()
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
        'pattern_type, weekly_weekdays, works_dow, offs_dow, weekend_rule, weekend_anchor_date, works_dow_mode'
      )
      .eq('therapist_id', ctx!.therapist.id)
      .single()

    expect(patternResult.error).toBeNull()
    expect(patternResult.data).toMatchObject({
      pattern_type: 'weekly_with_weekend_rotation',
      weekly_weekdays: [1, 3, 5],
      works_dow_mode: 'hard',
      offs_dow: [2],
      weekend_rule: 'every_other_weekend',
      weekend_anchor_date: nextSaturdayKey(),
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

  test('new therapist can keep rotating weekends with flexible weekdays', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')

    await loginAsAndGoTo(
      page,
      ctx!.flexibleTherapist.email,
      ctx!.flexibleTherapist.password,
      '/dashboard',
      /\/onboarding(?:[/?].*)?$/
    )
    await page.waitForLoadState('networkidle')

    const rotatingWeekendsOption = page.getByRole('button', { name: /Rotating weekends/i })
    await rotatingWeekendsOption.click()
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Choose your weekend rotation' })).toBeVisible()
    await page.getByRole('button', { name: /My weekdays vary/i }).click()
    await expect(
      page.getByText('No fixed weekdays will be applied. Your weekend rotation will still be used.')
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()

    const weekendGroup = page.getByRole('group', { name: 'First working weekend' })
    await weekendGroup.getByRole('button').first().click()
    await expect(page.getByText('Flexible weekdays + rotating weekends')).toBeVisible()
    await expect(page.getByRole('complementary').getByText('Weekdays: Flexible')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()

    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible()
    await page.getByRole('checkbox', { name: 'Tue' }).check()
    await page.getByRole('checkbox', { name: 'Thu' }).check()
    await expect(page.getByRole('complementary').getByText('Preferred work days:')).toBeVisible()
    await expect(page.getByRole('complementary').getByText('Tue, Thu')).toBeVisible()
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Does this look right?' })).toBeVisible()
    await expectConfirmRow(page, 'Schedule type', 'Rotating weekends')
    await expectConfirmRow(page, 'Weekdays', 'Flexible')
    await expectConfirmRow(page, 'Weekend rotation', 'Every other weekend')
    await expectConfirmRow(page, 'First working weekend', nextWeekendRangeLabel())
    await expectConfirmRow(page, 'Maximum days in a row', '3 days')
    await expectConfirmRow(page, 'Preferred work days', 'Tue, Thu')
    await expectConfirmRow(page, 'Never available', 'None')
    await page.getByRole('button', { name: 'Edit preferred work days' }).click()
    await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Does this look right?' })).toBeVisible()
    await page.getByRole('button', { name: 'Save and view my schedule' }).click()
    await expect(page).toHaveURL(
      /(?:\/onboarding\?success=setup_complete|\/dashboard(?:\/staff)?\?success=onboarding_complete)/,
      { timeout: 45_000 }
    )

    const patternResult = await ctx!.supabase
      .from('work_patterns')
      .select(
        'pattern_type, weekly_weekdays, works_dow, works_dow_mode, weekend_rule, weekend_anchor_date'
      )
      .eq('therapist_id', ctx!.flexibleTherapist.id)
      .single()

    expect(patternResult.error).toBeNull()
    expect(patternResult.data).toMatchObject({
      pattern_type: 'weekly_with_weekend_rotation',
      weekly_weekdays: [],
      works_dow_mode: 'soft',
      weekend_rule: 'every_other_weekend',
      weekend_anchor_date: nextSaturdayKey(),
    })
    expect(patternResult.data?.works_dow).toEqual([0, 6])

    const profileResult = await ctx!.supabase
      .from('profiles')
      .select('preferred_work_days, preferred_work_days_mode, staff_onboarding_completed_at')
      .eq('id', ctx!.flexibleTherapist.id)
      .single()

    expect(profileResult.error).toBeNull()
    expect(profileResult.data?.preferred_work_days).toEqual([2, 4])
    expect(profileResult.data?.preferred_work_days_mode).toBe('specific_days')
    expect(profileResult.data?.staff_onboarding_completed_at).toBeTruthy()
  })
})
