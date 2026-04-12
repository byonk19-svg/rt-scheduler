import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  staffViewer: { id: string; email: string; password: string }
  publishedCycle: { id: string; targetDate: string }
  emptyDraftCycle: { id: string; startDate: string }
  expectedNames: string[]
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

    const lead = await createE2EUser(supabase, {
      email: `${randomString('coverage-lead')}@example.com`,
      password: `Lead!${Math.random().toString(16).slice(2, 8)}`,
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

    createdUserIds.push(manager.id, staffViewer.id, lead.id, therapist.id, secondTherapist.id)

    const cycleStart = new Date()
    cycleStart.setDate(cycleStart.getDate() - 1)
    const cycleEnd = new Date(cycleStart)
    cycleEnd.setDate(cycleEnd.getDate() + 41)
    const targetDate = formatDateKey(new Date(cycleStart))

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
        date: targetDate,
        shift_type: 'day',
        role: 'lead',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: publishedCycleInsert.data.id,
        user_id: therapist.id,
        date: targetDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: publishedCycleInsert.data.id,
        user_id: secondTherapist.id,
        date: targetDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
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
      publishedCycle: { id: publishedCycleInsert.data.id, targetDate },
      emptyDraftCycle: {
        id: emptyDraftCycleInsert.data.id,
        startDate: emptyDraftCycleInsert.data.start_date,
      },
      expectedNames: [
        leadName.split(' ')[0]!,
        therapistName.split(' ')[0]!,
        secondTherapistName.split(' ')[0]!,
      ],
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

    const dayPanel = page.getByTestId(`coverage-day-panel-${ctx!.publishedCycle.targetDate}`)
    await expect(dayPanel).toBeVisible({ timeout: 15_000 })
    for (const name of ctx!.expectedNames) {
      await expect(dayPanel.getByText(name, { exact: false })).toBeVisible()
    }
    await expect(dayPanel.getByText('Unknown')).toHaveCount(0)
  })

  test('manager coverage keeps the draft grid interactive while showing the empty-draft prompt', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.emptyDraftCycle.id}`)

    await expect(page.getByRole('heading', { name: 'Block ready — no shifts yet' })).toBeVisible()
    await expect(
      page.getByText(
        'Run Auto-draft to fill the grid based on therapist availability and constraints, or click any day to assign shifts manually.'
      )
    ).toBeVisible()

    const dayCellButton = page.getByTestId(
      `coverage-day-cell-button-${ctx!.emptyDraftCycle.startDate}`
    )
    await expect(dayCellButton).toBeVisible()
    await dayCellButton.click({ position: { x: 18, y: 18 } })
    await expect(page.getByTestId('coverage-shift-editor-dialog')).toBeVisible()
  })
})
