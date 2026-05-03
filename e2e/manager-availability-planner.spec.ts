import { expect, test, type Locator } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  leadTherapist: { id: string }
  therapist: { id: string; fullName: string }
  prnTherapist: { id: string; fullName: string }
  cycle: { id: string; startDate: string; endDate: string }
  secondCycle: { id: string; startDate: string; endDate: string }
  therapistWillWorkDate: string
  therapistCannotWorkDate: string
  prnWillWorkDate: string
}

function formatCalendarLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

async function selectCalendarDay(root: Locator, isoDate: string) {
  const target = root.getByRole('button', { name: formatCalendarLabel(isoDate) })
  await target.click()
}

async function openManualEntryFromQueue(params: {
  page: import('@playwright/test').Page
  therapistId: string
}) {
  const { page, therapistId } = params
  const roster = page.locator('#availability-work-queue')
  const row = roster.locator(`[data-therapist-row="${therapistId}"]`)
  await row.locator('[data-enter-action]').click()
  return page.getByRole('dialog')
}

async function createCycle(supabase: SupabaseClient) {
  const startDate = addDays(new Date(), -1)
  const endDate = addDays(startDate, 13)
  const label = `Planner E2E ${randomString('cycle')}`
  const { data, error } = await supabase
    .from('schedule_cycles')
    .insert({
      label,
      start_date: formatDateKey(startDate),
      end_date: formatDateKey(endDate),
      published: false,
    })
    .select('id, start_date, end_date')
    .single()

  if (error || !data) {
    throw new Error(`Could not create test cycle: ${error?.message ?? 'unknown error'}`)
  }

  return {
    id: data.id,
    startDate: data.start_date,
    endDate: data.end_date,
  }
}

test.describe.serial('/availability manager planner', () => {
  test.setTimeout(90_000)
  let ctx: TestContext | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('planner-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'E2E Planner Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const leadTherapist = await createE2EUser(supabase, {
      email: `${randomString('planner-lead')}@example.com`,
      password: `Lead!${Math.random().toString(16).slice(2, 8)}`,
      fullName: 'E2E Lead Therapist',
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const therapistFullName = `E2E Planner Therapist ${randomString('ther')}`
    const therapist = await createE2EUser(supabase, {
      email: `${randomString('planner-ther')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    const prnFullName = `E2E Planner PRN ${randomString('prn')}`
    const prnTherapist = await createE2EUser(supabase, {
      email: `${randomString('planner-prn')}@example.com`,
      password: `Prn!${Math.random().toString(16).slice(2, 8)}`,
      fullName: prnFullName,
      role: 'therapist',
      employmentType: 'prn',
      shiftType: 'day',
      isLeadEligible: false,
    })

    const cycle = await createCycle(supabase)
    const secondCycle = await createCycle(supabase)
    const cycleStartDate = new Date(`${cycle.startDate}T00:00:00`)
    const therapistWillWorkDate = formatDateKey(addDays(cycleStartDate, 2))
    const therapistCannotWorkDate = formatDateKey(addDays(cycleStartDate, 4))
    const prnWillWorkDate = formatDateKey(addDays(cycleStartDate, 3))

    createdUserIds.push(manager.id, leadTherapist.id, therapist.id, prnTherapist.id)
    createdCycleIds.push(cycle.id, secondCycle.id)
    const submissionInsert = await supabase.from('therapist_availability_submissions').insert({
      therapist_id: therapist.id,
      schedule_cycle_id: cycle.id,
      submitted_at: new Date().toISOString(),
      last_edited_at: new Date().toISOString(),
    })

    if (submissionInsert.error) {
      throw new Error(`Could not seed planner submission state: ${submissionInsert.error.message}`)
    }

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      leadTherapist,
      therapist: { id: therapist.id, fullName: therapistFullName },
      prnTherapist: { id: prnTherapist.id, fullName: prnFullName },
      cycle,
      secondCycle,
      therapistWillWorkDate,
      therapistCannotWorkDate,
      prnWillWorkDate,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return
    await ctx.supabase.from('availability_overrides').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase
      .from('therapist_availability_submissions')
      .delete()
      .in('schedule_cycle_id', createdCycleIds)
    await ctx.supabase.from('schedule_cycles').delete().in('id', createdCycleIds)
    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
  })

  test('manager can focus a missing responder from the roster and switch cycles without a hard reload', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(
      `/availability?tab=planner&cycle=${ctx!.cycle.id}&therapist=${ctx!.therapist.id}`,
      {
        waitUntil: 'networkidle',
      }
    )

    await expect(page.getByRole('heading', { name: 'Availability Manager' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('#planner_cycle_id')).toHaveValue(ctx!.cycle.id)

    const initialNavigationCount = await page.evaluate(
      () => performance.getEntriesByType('navigation').length
    )

    const roster = page.locator('#availability-work-queue')
    const firstQueueRow = roster.locator('[data-therapist-row]').first()
    await firstQueueRow.locator('[data-review-action]').click()

    await expect
      .poll(() => page.url(), { timeout: 20_000 })
      .not.toContain(`therapist=${ctx!.therapist.id}`)
    await expect(roster.locator('[aria-current="true"]')).toBeVisible()
    await expect(roster.getByText('Selected')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Enter availability for/ })).toBeVisible()

    const afterTherapistNavigationCount = await page.evaluate(
      () => performance.getEntriesByType('navigation').length
    )
    expect(afterTherapistNavigationCount).toBe(initialNavigationCount)

    await page.locator('#planner_cycle_id').selectOption(ctx!.secondCycle.id)

    await expect
      .poll(() => page.url(), { timeout: 20_000 })
      .toContain(`cycle=${ctx!.secondCycle.id}`)
    await expect(page.locator('#planner_cycle_id')).toHaveValue(ctx!.secondCycle.id)
    await expect(roster.locator('[aria-current="true"]')).toBeVisible()

    const afterCycleNavigationCount = await page.evaluate(
      () => performance.getEntriesByType('navigation').length
    )
    expect(afterCycleNavigationCount).toBe(initialNavigationCount)
  })

  test('manager can save hard dates from Availability Manager', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(
      `/availability?cycle=${ctx!.cycle.id}&therapist=${ctx!.therapist.id}&roster=submitted`,
      {
        waitUntil: 'networkidle',
      }
    )

    await expect(page.getByRole('heading', { name: 'Availability Manager' })).toBeVisible({
      timeout: 20_000,
    })
    const editor = await openManualEntryFromQueue({
      page,
      therapistId: ctx!.therapist.id,
    })
    await expect(
      editor.getByRole('heading', { name: 'Edit availability for E2E' }).first()
    ).toBeVisible()

    await selectCalendarDay(editor, ctx!.therapistWillWorkDate)
    await selectCalendarDay(editor, ctx!.therapistCannotWorkDate)
    await editor.getByRole('button', { name: /^Save for E2E$/ }).click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('availability_overrides')
            .select('date')
            .eq('cycle_id', ctx!.cycle.id)
            .eq('therapist_id', ctx!.therapist.id)
            .eq('override_type', 'force_on')
          if (result.error) throw new Error(result.error.message)
          return (result.data ?? [])
            .map((row) => row.date)
            .sort()
            .join(',')
        },
        { timeout: 20_000 }
      )
      .toBe([ctx!.therapistWillWorkDate, ctx!.therapistCannotWorkDate].sort().join(','))

    await page.goto(
      `/availability?cycle=${ctx!.cycle.id}&therapist=${ctx!.therapist.id}&roster=submitted`,
      {
        waitUntil: 'networkidle',
      }
    )
    const refreshedEditor = await openManualEntryFromQueue({
      page,
      therapistId: ctx!.therapist.id,
    })
    await refreshedEditor.getByRole('button', { name: /^Cannot work$/ }).click()
    await expect(refreshedEditor.getByRole('button', { name: /^Save for E2E$/ })).toBeDisabled()
    await selectCalendarDay(refreshedEditor, ctx!.therapistCannotWorkDate)
    await expect(refreshedEditor.getByRole('button', { name: /^Save for E2E$/ })).toBeVisible()
    await refreshedEditor.getByRole('button', { name: /^Save for E2E$/ }).click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('availability_overrides')
            .select('id')
            .eq('cycle_id', ctx!.cycle.id)
            .eq('therapist_id', ctx!.therapist.id)
            .eq('date', ctx!.therapistCannotWorkDate)
            .eq('override_type', 'force_off')
          if (result.error) throw new Error(result.error.message)
          return result.data?.length ?? 0
        },
        { timeout: 20_000 }
      )
      .toBe(1)

    await page.goto(
      `/availability?cycle=${ctx!.cycle.id}&therapist=${ctx!.prnTherapist.id}&roster=all`,
      {
        waitUntil: 'networkidle',
      }
    )
    const prnEditor = await openManualEntryFromQueue({
      page,
      therapistId: ctx!.prnTherapist.id,
    })
    await selectCalendarDay(prnEditor, ctx!.prnWillWorkDate)
    await prnEditor.getByRole('button', { name: /^Save for E2E$/ }).click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('availability_overrides')
            .select('id')
            .eq('cycle_id', ctx!.cycle.id)
            .eq('therapist_id', ctx!.prnTherapist.id)
            .eq('date', ctx!.prnWillWorkDate)
            .eq('override_type', 'force_on')
          if (result.error) throw new Error(result.error.message)
          return result.data?.length ?? 0
        },
        { timeout: 20_000 }
      )
      .toBe(1)
  })
})
