import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
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

    const cycleStart = addDays(new Date(), -1)
    const cycleEnd = addDays(cycleStart, 41)
    const underDate = formatDateKey(cycleStart)
    const healthyDate = formatDateKey(addDays(cycleStart, 1))
    const overDate = formatDateKey(addDays(cycleStart, 2))
    const nightDate = healthyDate

    const publishedCycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Coverage Display Published ${randomString('cycle')}`,
        start_date: formatDateKey(cycleStart),
        end_date: formatDateKey(cycleEnd),
        published: true,
      })
      .select('id')
      .single()

    if (publishedCycleInsert.error || !publishedCycleInsert.data) {
      throw new Error(
        `Could not create published cycle: ${publishedCycleInsert.error?.message ?? 'unknown error'}`
      )
    }

    const emptyDraftCycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Coverage Display Draft ${randomString('cycle')}`,
        start_date: formatDateKey(cycleStart),
        end_date: formatDateKey(cycleEnd),
        published: false,
      })
      .select('id, start_date')
      .single()

    if (emptyDraftCycleInsert.error || !emptyDraftCycleInsert.data) {
      throw new Error(
        `Could not create draft cycle: ${emptyDraftCycleInsert.error?.message ?? 'unknown error'}`
      )
    }

    createdCycleIds.push(publishedCycleInsert.data.id, emptyDraftCycleInsert.data.id)

    const shiftsInsert = await supabase.from('shifts').insert([
      {
        cycle_id: publishedCycleInsert.data.id,
        user_id: lead.id,
        date: underDate,
        shift_type: 'day',
        role: 'lead',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: publishedCycleInsert.data.id,
        user_id: therapist.id,
        date: underDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: publishedCycleInsert.data.id,
        user_id: lead.id,
        date: healthyDate,
        shift_type: 'day',
        role: 'lead',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: publishedCycleInsert.data.id,
        user_id: therapist.id,
        date: healthyDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: publishedCycleInsert.data.id,
        user_id: secondTherapist.id,
        date: healthyDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: publishedCycleInsert.data.id,
        user_id: nightLead.id,
        date: nightDate,
        shift_type: 'night',
        role: 'lead',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      ...[lead, therapist, secondTherapist, ...extraTherapists].map((row, index) => ({
        cycle_id: publishedCycleInsert.data.id,
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
        id: publishedCycleInsert.data.id,
        startDate: formatDateKey(cycleStart),
        endDate: formatDateKey(cycleEnd),
        targetDate: healthyDate,
        underDate,
        healthyDate,
        overDate,
        nightDate,
      },
      emptyDraftCycle: {
        id: emptyDraftCycleInsert.data.id,
        startDate: emptyDraftCycleInsert.data.start_date,
      },
      expectedNames: [
        leadName.split(' ')[0]!,
        therapistName.split(' ')[0]!,
        secondTherapistName.split(' ')[0]!,
      ],
      nightLeadName: nightLeadName.split(' ')[0]!,
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

  test('staff coverage shows real therapist names for a published cycle', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.staffViewer.email, ctx!.staffViewer.password)
    await page.goto(`/coverage?cycle=${ctx!.publishedCycle.id}`)

    await expect(page.getByRole('heading', { name: 'Team Schedule' })).toBeVisible()
    await expect(
      page.getByText(
        'Read-only Team Schedule. Use My Shifts for your own shifts and Future Availability for the next Schedule Block.'
      )
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Block board' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    const dayPanel = page.locator(
      `[data-testid="coverage-day-panel-${ctx!.publishedCycle.targetDate}"]:visible`
    )
    await expect(dayPanel).toBeVisible({ timeout: 15_000 })
    await expect(dayPanel.getByText(/Lead:/)).toBeVisible()
    for (const name of ctx!.expectedNames) {
      await expect(dayPanel.getByText(name, { exact: false })).toBeVisible()
    }
    await expect(dayPanel.getByText('Unknown')).toHaveCount(0)

    await dayPanel.click()
    const drawer = page.getByTestId('coverage-shift-editor-dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('Your status')).toBeVisible()
    await expect(drawer.getByText('You are not scheduled')).toBeVisible()
    await expect(drawer.getByText('No assignment for you on this Day shift.')).toBeVisible()
    await expect(drawer.getByRole('heading', { name: 'Team Schedule details' })).toBeVisible()
    await expect(drawer.getByText('Manager-only actions')).toHaveCount(0)
    await expect(drawer.getByText('Lottery decision available')).toHaveCount(0)
  })

  test('lead selected-day drawer stays framed as Team Schedule without manager staffing actions', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.leadViewer.email, ctx!.leadViewer.password)
    await page.goto(`/coverage?cycle=${ctx!.publishedCycle.id}&view=week&shift=day`)

    await expect(page.getByRole('heading', { name: 'Team Schedule' })).toBeVisible()

    const dayPanel = page.locator(
      `[data-testid="coverage-day-panel-${ctx!.publishedCycle.targetDate}"]:visible`
    )
    await expect(dayPanel).toBeVisible({ timeout: 15_000 })
    await dayPanel.click()

    const drawer = page.getByTestId('coverage-shift-editor-dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('heading', { name: 'Team Schedule details' })).toBeVisible()
    await expect(drawer.getByText('Staffing edits stay in Coverage for managers.')).toBeVisible()
    await expect(drawer.getByTestId(/^coverage-drawer-status-/).first()).toBeVisible()
    await expect(drawer.getByText('Manager-only actions')).toHaveCount(0)
    await expect(drawer.getByText('Lottery decision available')).toHaveCount(0)
  })

  test('manager calendar renders the full cycle and keeps day/night cells independent', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.publishedCycle.id}&view=week&shift=day`)
    await expect(page.getByRole('heading', { name: 'Coverage' })).toBeVisible()

    const visibleDayPanels = page.locator('[data-testid^="coverage-day-panel-"]:visible')
    await expect(visibleDayPanels).toHaveCount(42, { timeout: 15_000 })
    await expect(
      page.locator(`[data-testid="coverage-day-panel-${ctx!.publishedCycle.startDate}"]:visible`)
    ).toBeVisible()
    await expect(
      page.locator(`[data-testid="coverage-day-panel-${ctx!.publishedCycle.endDate}"]:visible`)
    ).toBeVisible()

    const dayPanel = page.locator(
      `[data-testid="coverage-day-panel-${ctx!.publishedCycle.targetDate}"]:visible`
    )
    await expect(dayPanel.getByText(ctx!.expectedNames[0], { exact: false })).toBeVisible()

    await page.getByTestId('coverage-shift-tab-night').click()
    await expect(visibleDayPanels).toHaveCount(42, { timeout: 15_000 })

    const nightPanel = page.locator(
      `[data-testid="coverage-day-panel-${ctx!.publishedCycle.nightDate}"]:visible`
    )
    await expect(nightPanel.getByText(ctx!.nightLeadName, { exact: false })).toBeVisible()
    await expect(nightPanel.getByText(ctx!.expectedNames[0], { exact: false })).toHaveCount(0)
  })

  test('manager calendar headcount badge uses coverage min/max thresholds', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.publishedCycle.id}&view=week&shift=day`)
    await expect(page.getByRole('heading', { name: 'Coverage' })).toBeVisible()

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

    await expect(page.getByText('No shifts assigned yet', { exact: true })).toBeVisible()
    await expect(
      page.getByText('No shifts assigned yet. Run Auto-draft or click a day to assign manually.')
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Assign manually' })).toBeVisible()

    const dayCellButton = page.locator(
      `[data-testid="coverage-day-cell-button-${ctx!.emptyDraftCycle.startDate}"]:visible`
    )
    await expect(dayCellButton).toBeVisible()
    await dayCellButton.click({ position: { x: 18, y: 18 } })
    await expect(page.getByTestId('coverage-shift-editor-dialog')).toBeVisible()
  })
})
