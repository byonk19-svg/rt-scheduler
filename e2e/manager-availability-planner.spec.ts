import { expect, test, type Locator } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TestContext = {
  supabase: SupabaseClient
  siteId: string
  manager: { id: string; email: string; password: string }
  leadTherapist: { id: string }
  therapist: { id: string; email: string; password: string; fullName: string }
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

function nextSundayAfter(daysAhead: number): Date {
  const target = addDays(new Date(), daysAhead)
  return addDays(target, (7 - target.getDay()) % 7)
}

async function createCycle(supabase: SupabaseClient, siteId: string, daysAhead: number) {
  const startDate = nextSundayAfter(daysAhead)
  const endDate = addDays(startDate, 41)
  const label = `Planner E2E ${randomString('cycle')}`
  const { data, error } = await supabase
    .from('schedule_cycles')
    .insert({
      site_id: siteId,
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
    const siteId = randomString('planner-site')
    const siteInsert = await supabase.from('sites').insert({ id: siteId, name: 'Planner E2E Site' })
    if (siteInsert.error) throw new Error(siteInsert.error.message)

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
      siteId,
    })

    const leadTherapist = await createE2EUser(supabase, {
      email: `${randomString('planner-lead')}@example.com`,
      password: `Lead!${Math.random().toString(16).slice(2, 8)}`,
      fullName: 'E2E Lead Therapist',
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
      siteId,
    })

    const therapistFullName = `E2E Planner Therapist ${randomString('ther')}`
    const therapistEmail = `${randomString('planner-ther')}@example.com`
    const therapistPassword = `Ther!${Math.random().toString(16).slice(2, 8)}`
    const therapist = await createE2EUser(supabase, {
      email: therapistEmail,
      password: therapistPassword,
      fullName: therapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
      siteId,
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
      siteId,
    })

    const cycle = await createCycle(supabase, siteId, 120)
    const secondCycle = await createCycle(supabase, siteId, 190)
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
      siteId,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      leadTherapist,
      therapist: {
        id: therapist.id,
        email: therapistEmail,
        password: therapistPassword,
        fullName: therapistFullName,
      },
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
    await ctx.supabase.from('profiles').delete().in('id', createdUserIds)
    await ctx.supabase.from('sites').delete().eq('id', ctx.siteId)
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
    const reviewActions = roster.locator('[data-review-action]')
    const reviewActionCount = await reviewActions.count()
    let nextTherapistId: string | null = null
    for (let index = 0; index < reviewActionCount; index += 1) {
      const therapistId = await reviewActions.nth(index).getAttribute('data-review-action')
      if (therapistId && therapistId !== ctx!.therapist.id) {
        nextTherapistId = therapistId
        await reviewActions.nth(index).click()
        break
      }
    }

    expect(nextTherapistId).not.toBeNull()

    await expect
      .poll(() => page.url(), { timeout: 20_000 })
      .toContain(`therapist=${nextTherapistId}`)
    await expect(roster.locator(`[data-therapist-row="${nextTherapistId}"]`)).toHaveAttribute(
      'aria-current',
      'true'
    )
    await expect(page.locator('[data-availability-editor]')).toBeVisible()
    await expect(
      page.locator('[data-availability-editor]').getByRole('heading', { name: 'Edit availability' })
    ).toBeVisible()

    const afterTherapistNavigationCount = await page.evaluate(
      () => performance.getEntriesByType('navigation').length
    )
    expect(afterTherapistNavigationCount).toBe(initialNavigationCount)

    const cyclePicker = page.locator('#planner_cycle_id')
    const currentCycleId = await cyclePicker.inputValue()
    const cycleOptionCount = await page.locator('#planner_cycle_id option').count()
    let nextCycleId: string | null = null
    for (let index = 0; index < cycleOptionCount; index += 1) {
      const optionValue = await page
        .locator('#planner_cycle_id option')
        .nth(index)
        .getAttribute('value')
      if (optionValue && optionValue !== currentCycleId) {
        nextCycleId = optionValue
        break
      }
    }

    expect(nextCycleId).not.toBeNull()
    await cyclePicker.selectOption(nextCycleId!)

    await expect.poll(() => page.url(), { timeout: 20_000 }).toContain(`cycle=${nextCycleId}`)
    await expect(cyclePicker).toHaveValue(nextCycleId!)
    await expect(roster.locator('[aria-current="true"]')).toBeVisible()

    const afterCycleNavigationCount = await page.evaluate(
      () => performance.getEntriesByType('navigation').length
    )
    expect(afterCycleNavigationCount).toBe(initialNavigationCount)
  })

  test('manager can reopen locked availability after draft work starts', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    const lockedDate = ctx!.secondCycle.startDate
    const lateChangeDate = formatDateKey(
      addDays(new Date(`${ctx!.secondCycle.startDate}T00:00:00`), 1)
    )
    const shiftInsert = await ctx!.supabase.from('shifts').insert({
      cycle_id: ctx!.secondCycle.id,
      user_id: ctx!.therapist.id,
      date: lockedDate,
      shift_type: 'day',
      status: 'scheduled',
      role: 'staff',
    })
    if (shiftInsert.error) throw new Error(shiftInsert.error.message)

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await page.goto(`/therapist/availability?cycle=${ctx!.secondCycle.id}`, {
      waitUntil: 'networkidle',
    })
    await expect(page.getByText('Schedule building has started.')).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('button', { name: /Submit availability/ })).toBeDisabled()

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(
      `/availability?cycle=${ctx!.secondCycle.id}&therapist=${ctx!.therapist.id}&roster=all`,
      {
        waitUntil: 'networkidle',
      }
    )
    await page.getByText('Utilities', { exact: true }).click()
    await expect(page.getByText('Existing draft schedule work stays unchanged')).toBeVisible()
    await page.getByRole('button', { name: 'Reopen availability' }).click()
    await expect(page.getByText('Availability reopened.')).toBeVisible({ timeout: 20_000 })

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await page.goto(`/therapist/availability?cycle=${ctx!.secondCycle.id}`, {
      waitUntil: 'networkidle',
    })
    await expect(page.getByText('Schedule building has started.')).toHaveCount(0)
    await selectCalendarDay(page.locator('main'), lateChangeDate)
    await page
      .getByRole('button', { name: /^Need Off$/ })
      .first()
      .click()
    await page.getByRole('button', { name: /Submit availability/ }).click()
    await expect(page.getByText('Availability submitted for this cycle.')).toBeVisible({
      timeout: 20_000,
    })
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
    const editor = page.locator('[data-availability-editor]')
    await expect(editor.getByRole('heading', { name: 'Edit availability' })).toBeVisible()
    await expect(editor.getByRole('button', { name: /^Save for E2E$/ })).toBeDisabled()

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
    const refreshedEditor = page.locator('[data-availability-editor]')
    await refreshedEditor.getByRole('button', { name: /^Cannot work$/ }).click()
    await expect(refreshedEditor.getByRole('button', { name: /^Save for E2E$/ })).toBeDisabled()
    await selectCalendarDay(refreshedEditor, ctx!.therapistCannotWorkDate)
    await expect(refreshedEditor.getByRole('button', { name: /^Save for E2E$/ })).toBeEnabled()
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
      `/availability?cycle=${ctx!.cycle.id}&therapist=${ctx!.therapist.id}&roster=submitted`,
      {
        waitUntil: 'networkidle',
      }
    )
    const clearedEditor = page.locator('[data-availability-editor]')
    await clearedEditor.getByRole('button', { name: /^Cannot work$/ }).click()
    await expect(clearedEditor.getByRole('button', { name: /^Save for E2E$/ })).toBeDisabled()
    await clearedEditor.getByRole('button', { name: 'Clear selected dates' }).click()
    await expect(clearedEditor.getByRole('button', { name: /^Save for E2E$/ })).toBeEnabled()
    await clearedEditor.getByRole('button', { name: /^Save for E2E$/ }).click()

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
      .toBe(0)

    await page.goto(
      `/availability?cycle=${ctx!.cycle.id}&therapist=${ctx!.therapist.id}&roster=submitted`,
      {
        waitUntil: 'networkidle',
      }
    )
    const managerRequestEditor = page.locator('[data-availability-editor]')
    await managerRequestEditor.getByRole('button', { name: /^Need Off$/ }).click()
    await selectCalendarDay(managerRequestEditor, ctx!.therapistCannotWorkDate)
    await managerRequestEditor.getByRole('button', { name: /^Save for E2E$/ }).click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('availability_overrides')
            .select('source, intent, created_by')
            .eq('cycle_id', ctx!.cycle.id)
            .eq('therapist_id', ctx!.therapist.id)
            .eq('date', ctx!.therapistCannotWorkDate)
            .eq('shift_type', 'both')
            .eq('override_type', 'force_off')
            .maybeSingle()
          if (result.error) throw new Error(result.error.message)
          return `${result.data?.source ?? ''}:${result.data?.intent ?? ''}:${result.data?.created_by ?? ''}`
        },
        { timeout: 20_000 }
      )
      .toBe(`manager:therapist_need_off:${ctx!.manager.id}`)

    await page.goto(
      `/availability?cycle=${ctx!.cycle.id}&therapist=${ctx!.therapist.id}&roster=submitted`,
      {
        waitUntil: 'networkidle',
      }
    )
    const requestsOnFile = page
      .getByRole('heading', { name: 'Requests on file' })
      .locator('xpath=ancestor::section[1]')
    const savedRequestCard = requestsOnFile
      .locator('div')
      .filter({ hasText: formatCalendarLabel(ctx!.therapistCannotWorkDate) })
      .first()
    await expect(savedRequestCard.getByText('Manager edited', { exact: true })).toBeVisible()
    await expect(savedRequestCard.getByText('Need Off', { exact: true })).toBeVisible()

    await page.goto(
      `/availability?cycle=${ctx!.cycle.id}&therapist=${ctx!.prnTherapist.id}&roster=all`,
      {
        waitUntil: 'networkidle',
      }
    )
    const prnEditor = page.locator('[data-availability-editor]')
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
