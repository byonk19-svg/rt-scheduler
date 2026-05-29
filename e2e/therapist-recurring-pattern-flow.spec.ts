import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createScheduleCycle } from './helpers/schedule-cycles'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

function formatDateLabelE2E(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`)
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function availabilityDayButtonName(iso: string): RegExp {
  return new RegExp(`^${formatDateLabelE2E(iso)}\\b`)
}

function nextSaturdayKey() {
  const today = new Date()
  const offset = (6 - today.getDay() + 7) % 7
  return formatDateKey(addDays(today, offset))
}

type FlowCtx = {
  supabase: SupabaseClient
  therapist: { id: string; email: string; password: string }
  cycleId: string
  cycleStart: string
  offDate: string
}

test.describe.serial('therapist recurring pattern flow', () => {
  test.setTimeout(120_000)
  let ctx: FlowCtx | null = null
  const createdUserIds: string[] = []
  let createdCycleId: string | null = null

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const therapistEmail = `${randomString('pattern-ther')}@example.com`
    const therapistPassword = `Ther!${Math.random().toString(16).slice(2, 8)}`
    const therapist = await createE2EUser(supabase, {
      email: therapistEmail,
      password: therapistPassword,
      fullName: 'Pattern Flow Therapist',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(therapist.id)

    const { error: onboardingUpdateError } = await supabase
      .from('profiles')
      .update({
        staff_onboarding_required: false,
        staff_onboarding_completed_at: new Date().toISOString(),
        staff_onboarding_preferences_confirmed_at: new Date().toISOString(),
        staff_onboarding_theme_confirmed_at: new Date().toISOString(),
      })
      .eq('id', therapist.id)

    if (onboardingUpdateError) {
      throw new Error(
        `Could not mark pattern-flow therapist onboarded: ${onboardingUpdateError.message}`
      )
    }

    const cycle = await createScheduleCycle(supabase, {
      label: `Pattern Flow ${randomString('cycle')}`,
      startDate: addDays(new Date(), 14),
      published: false,
      availabilityDueAt: `${formatDateKey(addDays(new Date(), 21))}T17:00:00.000Z`,
    })
    const cycleStart = cycle.start_date
    createdCycleId = cycle.id

    ctx = {
      supabase,
      therapist: {
        id: therapist.id,
        email: therapistEmail,
        password: therapistPassword,
      },
      cycleId: cycle.id,
      cycleStart,
      offDate: formatDateKey(addDays(new Date(`${cycleStart}T12:00:00`), 5)),
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
      await ctx.supabase.from('work_patterns').delete().eq('therapist_id', ctx.therapist.id)
      await ctx.supabase.from('schedule_cycles').delete().eq('id', createdCycleId)
    }
    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
  })

  test('saves a repeating-cycle pattern and uses it to generate cycle availability', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required.')

    const overrideNote = `Cycle override ${randomString('note')}`

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await page.goto('/therapist/recurring-pattern')

    await page.getByRole('button', { name: /Repeating cycle/i }).click()
    await page.locator('#cycle-anchor-date').fill(ctx!.cycleStart)
    await page.getByRole('button', { name: /Save recurring pattern/i }).click()
    await expect(page.getByText('Recurring pattern saved.')).toBeVisible({ timeout: 45_000 })

    await page.goto(`/therapist/availability?cycle=${ctx!.cycleId}`)
    await expect(page.getByText('Starting point for this Schedule Block')).toBeVisible()
    await expect(page.getByText(/Repeats every 7 days starting/i)).toBeVisible()

    const offDayButton = page
      .getByRole('button', { name: availabilityDayButtonName(ctx!.offDate) })
      .first()
    await expect(offDayButton).toBeVisible({ timeout: 30_000 })
    await offDayButton.click()
    await expect(page.getByRole('heading', { name: 'Selected day' })).toBeVisible()
    await page
      .getByRole('button', { name: /^Need to Work$/ })
      .last()
      .click()

    const noteBox = page.locator(`textarea#therapist-day-note-${ctx!.offDate}`)
    await expect(noteBox).toBeVisible()
    await noteBox.fill(overrideNote)
    await page.getByRole('button', { name: /Save progress/i }).click()
    await page.waitForURL(/success=draft_saved/, { timeout: 45_000 })

    await page.goto(`/therapist/availability?cycle=${ctx!.cycleId}`)
    const reloadedOffDayButton = page
      .getByRole('button', { name: availabilityDayButtonName(ctx!.offDate) })
      .first()
    await expect(reloadedOffDayButton).toBeVisible({ timeout: 30_000 })
    await reloadedOffDayButton.click()
    await expect(page.getByRole('heading', { name: 'Selected day' })).toBeVisible()
    await expect(page.locator(`textarea#therapist-day-note-${ctx!.offDate}`)).toHaveValue(
      overrideNote,
      {
        timeout: 20_000,
      }
    )
  })

  test('saves rotating weekends with flexible weekdays from the recurring-pattern editor', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required.')

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await page.goto('/therapist/recurring-pattern')

    await page.getByRole('button', { name: /Rotating weekends/i }).click()
    await page.getByText('Weekday flexibility').click()
    await page.getByRole('button', { name: /My weekdays are flexible/i }).click()
    await page.getByRole('button', { name: /^Every other weekend$/ }).click()
    await page.locator('#weekend-anchor-date').fill(nextSaturdayKey())

    await expect(page.getByText('Rotating weekends. Weekdays: Flexible.')).toBeVisible()
    await page.getByRole('button', { name: /Save recurring pattern/i }).click()
    await expect(page.getByText('Recurring pattern saved.')).toBeVisible({ timeout: 45_000 })

    const patternResult = await ctx!.supabase
      .from('work_patterns')
      .select(
        'pattern_type, weekly_weekdays, works_dow, works_dow_mode, weekend_rule, weekend_anchor_date'
      )
      .eq('therapist_id', ctx!.therapist.id)
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
  })
})
