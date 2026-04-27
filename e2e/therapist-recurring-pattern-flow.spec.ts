import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

function formatDateLabelE2E(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`)
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

    const cycleStartDate = addDays(new Date(), 14)
    const cycleStart = formatDateKey(cycleStartDate)
    const cycleEnd = formatDateKey(addDays(cycleStartDate, 13))
    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Pattern Flow ${randomString('cycle')}`,
        start_date: cycleStart,
        end_date: cycleEnd,
        published: false,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'cycle insert failed')
    }
    createdCycleId = cycleInsert.data.id

    ctx = {
      supabase,
      therapist: {
        id: therapist.id,
        email: therapistEmail,
        password: therapistPassword,
      },
      cycleId: cycleInsert.data.id,
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
    await expect(page.getByText('Starting point for this cycle')).toBeVisible()
    await expect(page.getByText(/Repeats every 7 days starting/i)).toBeVisible()

    const offDayButton = page
      .getByRole('button', { name: new RegExp(`^${formatDateLabelE2E(ctx!.offDate)}$`) })
      .first()
    await expect(offDayButton).toBeVisible({ timeout: 30_000 })
    await offDayButton.click()
    await expect(page.getByText('Off day in your normal schedule')).toBeVisible()
    await page.getByRole('button', { name: /I can work this day/i }).click()

    const noteBox = page.locator(`textarea#therapist-day-note-${ctx!.offDate}`)
    await expect(noteBox).toBeVisible()
    await noteBox.fill(overrideNote)
    await page.getByRole('button', { name: /Save progress/i }).click()
    await page.waitForURL(/success=draft_saved/, { timeout: 45_000 })

    await page.goto(`/therapist/availability?cycle=${ctx!.cycleId}`)
    await offDayButton.click()
    await expect(page.locator(`textarea#therapist-day-note-${ctx!.offDate}`)).toHaveValue(
      overrideNote,
      {
        timeout: 20_000,
      }
    )
  })
})
