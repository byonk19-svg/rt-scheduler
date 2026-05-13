import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

function addOneDayIso(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return formatDateKey(addDays(d, 1))
}

function nextSunday(from = new Date()): Date {
  const start = new Date(from)
  start.setDate(start.getDate() + ((7 - start.getDay()) % 7))
  return start
}

/** Matches the therapist availability day button accessible name. */
function formatDateLabelE2E(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`)
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function expectShiftTabActive(page: import('@playwright/test').Page, tab: 'day' | 'night') {
  const label = tab === 'day' ? 'Day' : 'Night'
  const btn = page.getByRole('button', { name: label }).first()
  await expect(btn).toBeVisible()
  const cls = await btn.evaluate((el) => el.className)
  expect(cls).toMatch(/bg-primary/)
}

type SmokeCtx = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  dayTherapist: { id: string; email: string; password: string; firstName: string; name: string }
  nightTherapist: { id: string; email: string; password: string; firstName: string; name: string }
  scheduleCycleId: string
  cycleId: string
  availabilityDate: string
  availabilityDate2: string
}

test.describe.serial('therapist schedule + trust smoke (signed-in)', () => {
  test.setTimeout(120_000)
  let ctx: SmokeCtx | null = null
  let cleanupSupabase: SupabaseClient | null = null
  const createdUserIds: string[] = []
  const createdSiteIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return
    cleanupSupabase = supabase
    const siteId = randomString('trust-site')
    const siteInsert = await supabase.from('sites').insert({
      id: siteId,
      name: `Trust Smoke ${siteId}`,
    })
    if (siteInsert.error) {
      throw new Error(`Could not create test site: ${siteInsert.error.message}`)
    }
    createdSiteIds.push(siteId)

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
      siteId,
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
      siteId,
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
      siteId,
    })
    createdUserIds.push(nightT.id)

    const availabilityCycleStart = nextSunday(addDays(new Date(), 3))
    const availabilityCycleEnd = addDays(availabilityCycleStart, 41)
    const scheduleCycleStart = addDays(availabilityCycleEnd, 1)
    const scheduleCycleEnd = addDays(scheduleCycleStart, 41)
    const availabilityStartKey = formatDateKey(availabilityCycleStart)
    const availabilityEndKey = formatDateKey(availabilityCycleEnd)
    const scheduleStartKey = formatDateKey(scheduleCycleStart)
    const scheduleEndKey = formatDateKey(scheduleCycleEnd)
    const availabilityDate = formatDateKey(
      new Date(availabilityCycleStart.getTime() + 3 * 86400000)
    )
    const availabilityDate2 = addOneDayIso(availabilityDate)

    const availabilityCycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Trust Availability ${randomString('c')}`,
        start_date: availabilityStartKey,
        end_date: availabilityEndKey,
        published: false,
        site_id: siteId,
      })
      .select('id')
      .single()

    if (availabilityCycleInsert.error || !availabilityCycleInsert.data) {
      throw new Error(availabilityCycleInsert.error?.message ?? 'availability cycle insert failed')
    }

    const scheduleCycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Trust Schedule ${randomString('c')}`,
        start_date: scheduleStartKey,
        end_date: scheduleEndKey,
        published: true,
        site_id: siteId,
      })
      .select('id')
      .single()

    if (scheduleCycleInsert.error || !scheduleCycleInsert.data) {
      throw new Error(scheduleCycleInsert.error?.message ?? 'schedule cycle insert failed')
    }

    createdCycleIds.push(availabilityCycleInsert.data.id, scheduleCycleInsert.data.id)

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      dayTherapist: {
        id: dayT.id,
        email: dayEmail,
        password: dayPassword,
        firstName: dayTherapistFull.split(' ')[0]!,
        name: dayTherapistFull,
      },
      nightTherapist: {
        id: nightT.id,
        email: nightEmail,
        password: nightPassword,
        firstName: nightTherapistFull.split(' ')[0]!,
        name: nightTherapistFull,
      },
      scheduleCycleId: scheduleCycleInsert.data.id,
      cycleId: availabilityCycleInsert.data.id,
      availabilityDate,
      availabilityDate2,
    }
  })

  test.afterAll(async () => {
    const supabase = ctx?.supabase ?? cleanupSupabase
    if (!supabase) return
    if (createdCycleIds.length > 0) {
      await supabase
        .from('therapist_availability_submissions')
        .delete()
        .in('schedule_cycle_id', createdCycleIds)
      await supabase.from('availability_overrides').delete().in('cycle_id', createdCycleIds)
      await supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
      await supabase.from('schedule_cycles').delete().in('id', createdCycleIds)
    }
    for (const userId of createdUserIds) {
      await supabase.auth.admin.deleteUser(userId)
    }
    if (createdSiteIds.length > 0) {
      await supabase.from('sites').delete().in('id', createdSiteIds)
    }
  })

  test('day-shift therapist lands on Day Shift tab on schedule', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    await loginAs(page, ctx!.dayTherapist.email, ctx!.dayTherapist.password)
    await page.goto(`/schedule?cycle=${ctx!.scheduleCycleId}`)
    await expectShiftTabActive(page, 'day')
  })

  test('night-shift therapist lands on Night Shift tab on schedule', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    await loginAs(page, ctx!.nightTherapist.email, ctx!.nightTherapist.password)
    await page.goto(`/schedule?cycle=${ctx!.scheduleCycleId}`)
    await expectShiftTabActive(page, 'night')
  })

  test('explicit ?shift=day wins over night profile default', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    await loginAs(page, ctx!.nightTherapist.email, ctx!.nightTherapist.password)
    await page.goto(`/schedule?cycle=${ctx!.scheduleCycleId}&shift=day`)
    await expectShiftTabActive(page, 'day')
  })

  test('explicit ?shift=night wins over day profile default', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    await loginAs(page, ctx!.dayTherapist.email, ctx!.dayTherapist.password)
    await page.goto(`/schedule?cycle=${ctx!.scheduleCycleId}&shift=night`)
    await expectShiftTabActive(page, 'night')
  })

  test('Need Off note persists after submit + reload', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    const noteText = `E2E trust note ${randomString('n')}`
    const iso = ctx!.availabilityDate
    await loginAs(page, ctx!.dayTherapist.email, ctx!.dayTherapist.password)
    await page.goto(`/therapist/availability?cycle=${ctx!.cycleId}`)

    const dayBtn = page
      .getByRole('button', { name: new RegExp(`^${formatDateLabelE2E(iso)}$`) })
      .first()
    await expect(dayBtn).toBeVisible({ timeout: 30_000 })
    await dayBtn.click()
    await expect(page.getByText('Selected Day')).toBeVisible()
    await page.getByRole('button', { name: 'Need Off' }).first().click()
    const noteBox = page.locator(`textarea#therapist-day-note-${iso}`)
    await expect(noteBox).toBeVisible()
    await expect(noteBox).toBeEnabled()
    await noteBox.fill(noteText)

    await page.getByRole('button', { name: /submit availability/i }).click()
    await expect(page.getByText('Submitted with cycle-specific changes.')).toBeVisible({
      timeout: 45_000,
    })

    await page.goto(`/therapist/availability?cycle=${ctx!.cycleId}`)
    await expect(page.getByText(noteText).first()).toBeVisible({ timeout: 20_000 })
  })

  test('Submitted Availability row detail shows Entry saved', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    const detailNote = `E2E detail note ${randomString('detail')}`

    const upsertResult = await ctx!.supabase.from('availability_overrides').upsert(
      {
        therapist_id: ctx!.dayTherapist.id,
        cycle_id: ctx!.cycleId,
        date: ctx!.availabilityDate,
        shift_type: 'both',
        override_type: 'force_off',
        intent: 'therapist_need_off',
        note: detailNote,
        created_by: ctx!.dayTherapist.id,
        source: 'therapist',
      },
      { onConflict: 'cycle_id,therapist_id,date,shift_type' }
    )
    expect(upsertResult.error).toBeNull()

    const submissionResult = await ctx!.supabase.from('therapist_availability_submissions').upsert(
      {
        therapist_id: ctx!.dayTherapist.id,
        schedule_cycle_id: ctx!.cycleId,
        submitted_at: new Date().toISOString(),
        last_edited_at: new Date().toISOString(),
      },
      { onConflict: 'therapist_id,schedule_cycle_id' }
    )
    expect(submissionResult.error).toBeNull()

    await loginAs(page, ctx!.dayTherapist.email, ctx!.dayTherapist.password)
    await page.goto(`/therapist/availability?cycle=${ctx!.cycleId}`)
    const row = page.locator('tr').filter({ hasText: detailNote }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    const viewButton = row.getByRole('button', { name: 'View' })
    await expect(viewButton).toBeVisible({ timeout: 15_000 })
    await viewButton.click()
    await expect(row.getByRole('button', { name: 'Hide' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Entry saved').last()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(detailNote).last()).toBeVisible({ timeout: 15_000 })
  })

  test('unmarked days show truthful note copy without an editable note field', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required.')
    const iso2 = ctx!.availabilityDate2
    await loginAs(page, ctx!.dayTherapist.email, ctx!.dayTherapist.password)
    await page.goto(`/therapist/availability?cycle=${ctx!.cycleId}`)

    const dayBtn = page
      .getByRole('button', { name: new RegExp(`^${formatDateLabelE2E(iso2)}$`) })
      .first()
    await expect(dayBtn).toBeVisible({ timeout: 30_000 })
    await dayBtn.click()
    await expect(
      page.getByText('Notes are only saved for days you change for this cycle.')
    ).toBeVisible()
    await expect(page.locator(`textarea#therapist-day-note-${iso2}`)).toBeDisabled()
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
      intent: 'therapist_need_off',
      note: 'e2e roster test',
      created_by: nightTherapist.id,
      source: 'therapist',
    })

    await loginAs(page, manager.email, manager.password)

    await page.goto(`/availability?cycle=${cycleId}`)
    await page.getByRole('button', { name: 'Night shift' }).click()
    await page.getByPlaceholder('Search therapists...').fill(nightTherapist.name)
    await page.getByRole('button', { name: /Missing submissions/ }).click()
    await expect(
      page
        .getByRole('button', {
          name: new RegExp(`${nightTherapist.name}.*Not submitted`, 'i'),
        })
        .first()
    ).toBeVisible({ timeout: 20_000 })

    await supabase.from('therapist_availability_submissions').insert({
      therapist_id: nightTherapist.id,
      schedule_cycle_id: cycleId,
      submitted_at: new Date().toISOString(),
      last_edited_at: new Date().toISOString(),
    })

    await page.goto(`/availability?cycle=${cycleId}`)
    await page.getByRole('button', { name: 'Night shift' }).click()
    await page.getByPlaceholder('Search therapists...').fill(nightTherapist.name)
    await page.getByRole('button', { name: /Submitted with exceptions/ }).click()
    await expect(
      page
        .getByRole('button', {
          name: new RegExp(`${nightTherapist.name}.*Submitted`, 'i'),
        })
        .first()
    ).toBeVisible({ timeout: 20_000 })
  })
})
