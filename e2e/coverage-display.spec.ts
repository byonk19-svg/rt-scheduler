import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createScheduleCycle } from './helpers/schedule-cycles'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  staffViewer: { id: string; email: string; password: string }
  leadViewer: { id: string; email: string; password: string }
  publishedCycle: {
    id: string
    startDate: string
    endDate: string
    targetDate: string
    underDate: string
    healthyDate: string
    overDate: string
    nightDate: string
  }
  emptyDraftCycle: { id: string; startDate: string }
  expectedNames: string[]
  nightLeadName: string
}

test.describe.serial('coverage display regressions', () => {
  test.setTimeout(90_000)
  let ctx: TestContext | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('coverage-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Coverage Display Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const staffViewerEmail = `${randomString('coverage-viewer')}@example.com`
    const staffViewerPassword = `Ther!${Math.random().toString(16).slice(2, 8)}`
    const staffViewer = await createE2EUser(supabase, {
      email: staffViewerEmail,
      password: staffViewerPassword,
      fullName: 'Coverage Viewer Person',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    const leadName = `LeadDisplay ${randomString('lead')}`
    const therapistName = `StaffDisplay ${randomString('staff')}`
    const secondTherapistName = `FloatDisplay ${randomString('float')}`
    const nightLeadName = `NightDisplay ${randomString('lead')}`

    const leadEmail = `${randomString('coverage-lead')}@example.com`
    const leadPassword = `Lead!${Math.random().toString(16).slice(2, 8)}`
    const lead = await createE2EUser(supabase, {
      email: leadEmail,
      password: leadPassword,
      fullName: leadName,
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const therapist = await createE2EUser(supabase, {
      email: `${randomString('coverage-staff')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapistName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    const secondTherapist = await createE2EUser(supabase, {
      email: `${randomString('coverage-float')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: secondTherapistName,
      role: 'therapist',
      employmentType: 'part_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    const extraTherapists: Array<{ id: string; fullName: string }> = []
    for (let index = 0; index < 3; index += 1) {
      const extraName = `ExtraDisplay${index + 1} ${randomString('extra')}`
      const extraTherapist = await createE2EUser(supabase, {
        email: `${randomString(`coverage-extra-${index}`)}@example.com`,
        password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
        fullName: extraName,
        role: 'therapist',
        employmentType: 'full_time',
        shiftType: 'day',
        isLeadEligible: false,
      })
      extraTherapists.push({ id: extraTherapist.id, fullName: extraName })
    }

    const nightLead = await createE2EUser(supabase, {
      email: `${randomString('coverage-night-lead')}@example.com`,
      password: `Lead!${Math.random().toString(16).slice(2, 8)}`,
      fullName: nightLeadName,
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'night',
      isLeadEligible: true,
    })

    createdUserIds.push(
      manager.id,
      staffViewer.id,
      lead.id,
      therapist.id,
      secondTherapist.id,
      nightLead.id,
      ...extraTherapists.map((row) => row.id)
    )

    const publishedCycle = await createScheduleCycle(supabase, {
      label: `Coverage Display Published ${randomString('cycle')}`,
      startDate: new Date(),
      align: 'on-or-before',
      published: true,
    })
    const emptyDraftCycle = await createScheduleCycle(supabase, {
      label: `Coverage Display Draft ${randomString('cycle')}`,
      startDate: addDays(new Date(`${publishedCycle.end_date}T00:00:00`), 1),
      published: false,
    })

    const cycleStart = new Date(`${publishedCycle.start_date}T00:00:00`)
    const underDate = formatDateKey(cycleStart)
    const healthyDate = formatDateKey(addDays(cycleStart, 1))
    const overDate = formatDateKey(addDays(cycleStart, 2))
    const nightDate = healthyDate

    createdCycleIds.push(publishedCycle.id, emptyDraftCycle.id)

    const shiftsInsert = await supabase.from('shifts').insert([
      {
        cycle_id: publishedCycle.id,
        user_id: lead.id,
        date: underDate,
        shift_type: 'day',
        role: 'lead',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: publishedCycle.id,
        user_id: therapist.id,
        date: underDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: publishedCycle.id,
        user_id: lead.id,
        date: healthyDate,
        shift_type: 'day',
        role: 'lead',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: publishedCycle.id,
        user_id: therapist.id,
        date: healthyDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: publishedCycle.id,
        user_id: secondTherapist.id,
        date: healthyDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: publishedCycle.id,
        user_id: nightLead.id,
        date: nightDate,
        shift_type: 'night',
        role: 'lead',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      ...[lead, therapist, secondTherapist, ...extraTherapists].map((row, index) => ({
        cycle_id: publishedCycle.id,
        user_id: row.id,
        date: overDate,
        shift_type: 'day' as const,
        role: index === 0 ? ('lead' as const) : ('staff' as const),
        status: 'scheduled' as const,
        assignment_status: 'scheduled' as const,
      })),
    ])

    if (shiftsInsert.error) {
      throw new Error(`Could not seed display shifts: ${shiftsInsert.error.message}`)
    }

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      staffViewer: {
        id: staffViewer.id,
        email: staffViewerEmail,
        password: staffViewerPassword,
      },
      leadViewer: {
        id: lead.id,
        email: leadEmail,
        password: leadPassword,
      },
      publishedCycle: {
        id: publishedCycle.id,
        startDate: publishedCycle.start_date,
        endDate: publishedCycle.end_date,
        targetDate: healthyDate,
        underDate,
        healthyDate,
        overDate,
        nightDate,
      },
      emptyDraftCycle: {
        id: emptyDraftCycle.id,
        startDate: emptyDraftCycle.start_date,
      },
      expectedNames: [leadName, therapistName, secondTherapistName],
      nightLeadName,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return
    for (const cycleId of createdCycleIds) {
      await ctx.supabase.from('shifts').delete().eq('cycle_id', cycleId)
      await ctx.supabase.from('schedule_cycles').delete().eq('id', cycleId)
    }
    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
  })

  test('staff schedule shows the signed-in staff row for a published cycle', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.staffViewer.email, ctx!.staffViewer.password)
    await page.goto(`/coverage?cycle=${ctx!.publishedCycle.id}`)

    await expect(page).toHaveURL(/\/schedule/)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await expect(page.getByText('Access Read-only')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Schedule Block' })).toHaveValue(
      ctx!.publishedCycle.id
    )

    await expect(page.getByRole('rowheader').filter({ hasText: 'You' })).toBeVisible()
    await expect(page.getByText('Unknown')).toHaveCount(0)
  })

  test('lead schedule stays read-only without manager staffing actions', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.leadViewer.email, ctx!.leadViewer.password)
    await page.goto(`/coverage?cycle=${ctx!.publishedCycle.id}&view=week&shift=day`)

    await expect(page).toHaveURL(/\/schedule/)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Auto-draft' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0)
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('manager schedule renders the full cycle and keeps day/night controls independent', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.publishedCycle.id}&view=week&shift=day`)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined)

    await expect(page.getByRole('columnheader')).toHaveCount(43, { timeout: 15_000 })
    await expect(
      page.getByRole('rowheader').filter({ hasText: ctx!.expectedNames[0] })
    ).toBeVisible()

    const nightShiftTab = page.getByRole('button', { name: 'Night shift' }).first()
    await expect(nightShiftTab).toBeEnabled({ timeout: 15_000 })
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await nightShiftTab.click()
      if (page.url().includes('shift=night')) break
      await page.waitForTimeout(500)
    }
    await expect(page).toHaveURL(/shift=night/, { timeout: 15_000 })
    await expect(page.getByRole('columnheader')).toHaveCount(43, { timeout: 15_000 })
    await expect(page.getByRole('rowheader').filter({ hasText: ctx!.nightLeadName })).toBeVisible()
  })

  test('manager calendar headcount badge uses coverage min/max thresholds', async ({ page }) => {
    test.skip(true, 'Legacy calendar headcount badges were replaced by the unified schedule grid.')
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.publishedCycle.id}&view=week&shift=day`)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()

    const underBadge = page
      .locator(`[data-testid="coverage-headcount-badge-${ctx!.publishedCycle.underDate}"]:visible`)
      .first()
    const healthyBadge = page
      .locator(
        `[data-testid="coverage-headcount-badge-${ctx!.publishedCycle.healthyDate}"]:visible`
      )
      .first()
    const overBadge = page
      .locator(`[data-testid="coverage-headcount-badge-${ctx!.publishedCycle.overDate}"]:visible`)
      .first()

    await expect(underBadge).toContainText('2/3-5')
    await expect(underBadge).toHaveClass(/error-text/)
    await expect(healthyBadge).toContainText('3/3-5')
    await expect(healthyBadge).toHaveClass(/success-text/)
    await expect(overBadge).toContainText('6/3-5')
    await expect(overBadge).toHaveClass(/warning-text/)
  })

  test('manager coverage keeps the draft grid interactive while showing the empty-draft prompt', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.emptyDraftCycle.id}`)

    await expect(page).toHaveURL(/\/schedule/)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Schedule Block' })).toHaveValue(
      ctx!.emptyDraftCycle.id
    )
    await expect(page.getByRole('button', { name: 'Auto-draft' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pre-flight' })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
  })
})
