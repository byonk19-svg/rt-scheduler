import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

function addOneDayIso(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return formatDateKey(addDays(d, 1))
}

/** Matches `formatDateLabel` / therapist grid `aria-label` date prefix. */
function formatDateLabelE2E(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`)
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function expectShiftTabActive(page: import('@playwright/test').Page, tab: 'day' | 'night') {
  const btn = page.getByTestId(`coverage-shift-tab-${tab}`).first()
  await expect(btn).toBeVisible()
  const cls = await btn.evaluate((el) => el.className)
  expect(cls).toMatch(/bg-primary/)
}

type SmokeCtx = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  dayTherapist: { id: string; email: string; password: string; firstName: string }
  nightTherapist: { id: string; email: string; password: string; firstName: string }
  cycleId: string
  availabilityDate: string
  availabilityDate2: string
}

test.describe.serial('therapist schedule + trust smoke (signed-in)', () => {
  test.setTimeout(120_000)
  let ctx: SmokeCtx | null = null
  const createdUserIds: string[] = []
  let createdCycleId: string | null = null

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('trust-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Trust Smoke Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(manager.id)

    const dayTherapistFull = `DayTrust ${randomString('dt')}`
    const dayEmail = `${randomString('trust-day')}@example.com`
    const dayPassword = `Ther!${Math.random().toString(16).slice(2, 8)}`
    const dayT = await createE2EUser(supabase, {
      email: dayEmail,
      password: dayPassword,
      fullName: dayTherapistFull,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(dayT.id)

    const nightTherapistFull = `NightTrust ${randomString('nt')}`
    const nightEmail = `${randomString('trust-night')}@example.com`
    const nightPassword = `Ther!${Math.random().toString(16).slice(2, 8)}`
    const nightT = await createE2EUser(supabase, {
      email: nightEmail,
      password: nightPassword,
      fullName: nightTherapistFull,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'night',
      isLeadEligible: false,
    })
    createdUserIds.push(nightT.id)

    const cycleStart = new Date()
    cycleStart.setDate(cycleStart.getDate() - 2)
    const cycleEnd = new Date(cycleStart)
    cycleEnd.setDate(cycleEnd.getDate() + 41)
    const startKey = formatDateKey(cycleStart)
    const endKey = formatDateKey(cycleEnd)
    const availabilityDate = formatDateKey(new Date(cycleStart.getTime() + 3 * 86400000))
    const availabilityDate2 = addOneDayIso(availabilityDate)

    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Trust Smoke ${randomString('c')}`,
        start_date: startKey,
        end_date: endKey,
        published: true,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'cycle insert failed')
    }
    createdCycleId = cycleInsert.data.id

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      dayTherapist: {
        id: dayT.id,
        email: dayEmail,
        password: dayPassword,
        firstName: dayTherapistFull.split(' ')[0]!,
      },
      nightTherapist: {
        id: nightT.id,
        email: nightEmail,
        password: nightPassword,
        firstName: nightTherapistFull.split(' ')[0]!,
      },
      cycleId: cycleInsert.data.id,
      availabilityDate,
      availabilityDate2,
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
      await ctx.supabase.from('shifts').delete().eq('cycle_id', createdCycleId)
      await ctx.supabase.from('schedule_cycles').delete().eq('id', createdCycleId)
    }
    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
  })

  test('day-shift therapist lands on Day Shift tab on schedule', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    await loginAs(page, ctx!.dayTherapist.email, ctx!.dayTherapist.password)
    await page.goto(`/coverage?view=week&cycle=${ctx!.cycleId}`)
    await expectShiftTabActive(page, 'day')
  })

  test('night-shift therapist lands on Night Shift tab on schedule', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    await loginAs(page, ctx!.nightTherapist.email, ctx!.nightTherapist.password)
    await page.goto(`/coverage?view=week&cycle=${ctx!.cycleId}`)
    await expectShiftTabActive(page, 'night')
  })

  test('explicit ?shift=day wins over night profile default', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    await loginAs(page, ctx!.nightTherapist.email, ctx!.nightTherapist.password)
    await page.goto(`/coverage?view=week&cycle=${ctx!.cycleId}&shift=day`)
    await expectShiftTabActive(page, 'day')
  })

  test('explicit ?shift=night wins over day profile default', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    await loginAs(page, ctx!.dayTherapist.email, ctx!.dayTherapist.password)
    await page.goto(`/coverage?view=week&cycle=${ctx!.cycleId}&shift=night`)
    await expectShiftTabActive(page, 'night')
  })

  test('Need Off note persists after submit + reload', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    const noteText = `E2E trust note ${randomString('n')}`
    const iso = ctx!.availabilityDate
    await loginAs(page, ctx!.dayTherapist.email, ctx!.dayTherapist.password)
    await page.goto(`/therapist/availability?cycle=${ctx!.cycleId}`)

    const dayBtn = page
      .getByRole('button', { name: new RegExp(`^${formatDateLabelE2E(iso)}:`) })
      .first()
    await expect(dayBtn).toBeVisible({ timeout: 30_000 })
    await dayBtn.click()
    await expect(page.getByText('Selected Day')).toBeVisible()
    const noteBox = page.locator(`textarea#therapist-day-note-${iso}`)
    await expect(noteBox).toBeVisible()
    await noteBox.fill(noteText)

    await page.getByRole('button', { name: /submit availability/i }).click()
    await expect(
      page.getByText(/availability saved and submitted/i).or(page.getByText(/saved and submitted/i))
    ).toBeVisible({ timeout: 45_000 })

    await page.goto(`/therapist/availability?cycle=${ctx!.cycleId}`)
    await expect(page.getByText(noteText).first()).toBeVisible({ timeout: 20_000 })
  })

  test('Submitted Availability row detail shows Entry saved', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    await loginAs(page, ctx!.dayTherapist.email, ctx!.dayTherapist.password)
    await page.goto(`/therapist/availability?cycle=${ctx!.cycleId}`)
    await page.locator('table').getByRole('button', { name: 'View' }).first().click()
    await expect(page.getByText('Entry saved').first()).toBeVisible({ timeout: 15_000 })
  })

  test('selecting Available shows truthful note copy (no editable note field)', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    const iso2 = ctx!.availabilityDate2
    await loginAs(page, ctx!.dayTherapist.email, ctx!.dayTherapist.password)
    await page.goto(`/therapist/availability?cycle=${ctx!.cycleId}`)

    const dayBtn = page
      .getByRole('button', { name: new RegExp(`^${formatDateLabelE2E(iso2)}:`) })
      .first()
    await expect(dayBtn).toBeVisible({ timeout: 30_000 })
    await dayBtn.click()
    await dayBtn.click()
    await dayBtn.click()
    await expect(
      page.getByText('Notes are only saved for Need Off or Request to Work days.')
    ).toBeVisible()
    await expect(page.locator(`textarea#therapist-day-note-${iso2}`)).toHaveCount(0)
  })

  test('manager response roster matches official submission for same therapist/cycle', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    const { supabase, manager, nightTherapist, cycleId, availabilityDate } = ctx!

    await supabase.from('therapist_availability_submissions').delete().match({
      therapist_id: nightTherapist.id,
      schedule_cycle_id: cycleId,
    })
    await supabase.from('availability_overrides').delete().match({
      therapist_id: nightTherapist.id,
      cycle_id: cycleId,
    })
    await supabase.from('availability_overrides').insert({
      therapist_id: nightTherapist.id,
      cycle_id: cycleId,
      date: availabilityDate,
      shift_type: 'both',
      override_type: 'force_off',
      note: 'e2e roster test',
      created_by: nightTherapist.id,
      source: 'therapist',
    })

    await loginAs(page, manager.email, manager.password)
    const responseRoster = page
      .locator('section')
      .filter({ has: page.locator('#availability-response-heading') })
    const rosterPanels = responseRoster.locator('div.overflow-y-auto > div.space-y-3')

    await page.goto(`/availability?cycle=${cycleId}`)
    await responseRoster.getByRole('button', { name: /Not submitted yet/ }).click()
    await expect(
      rosterPanels.nth(0).getByText(nightTherapist.firstName, { exact: false })
    ).toBeVisible({ timeout: 20_000 })

    await supabase.from('therapist_availability_submissions').insert({
      therapist_id: nightTherapist.id,
      schedule_cycle_id: cycleId,
      submitted_at: new Date().toISOString(),
      last_edited_at: new Date().toISOString(),
    })

    await page.goto(`/availability?cycle=${cycleId}`)
    // Official submission moves this therapist off "Not submitted"; name only exists in Submitted panel.
    await responseRoster.getByRole('button', { name: /^Submitted\b/ }).click()
    await expect(
      rosterPanels.nth(1).getByText(nightTherapist.firstName, { exact: false })
    ).toBeVisible({ timeout: 20_000 })
  })
})
