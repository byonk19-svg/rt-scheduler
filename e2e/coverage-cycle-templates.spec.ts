import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TemplateCtx = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  lead: { id: string; fullName: string }
  staff: { id: string; fullName: string }
  publishedCycleId: string
  draftCycleId: string
  draftStartDate: string
}

test.describe.serial('coverage cycle templates', () => {
  test.setTimeout(120_000)

  let ctx: TemplateCtx | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []
  const createdTemplateNames: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('template-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 10)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Template Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const leadFullName = `Template Lead ${randomString('lead')}`
    const lead = await createE2EUser(supabase, {
      email: `${randomString('template-lead')}@example.com`,
      password: `Lead!${Math.random().toString(16).slice(2, 10)}`,
      fullName: leadFullName,
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const staffFullName = `Template Staff ${randomString('staff')}`
    const staff = await createE2EUser(supabase, {
      email: `${randomString('template-staff')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 10)}`,
      fullName: staffFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    createdUserIds.push(manager.id, lead.id, staff.id)

    const publishedStart = addDays(new Date(), 14)
    const publishedEnd = addDays(publishedStart, 41)
    const draftStart = addDays(new Date(), 70)
    const draftEnd = addDays(draftStart, 41)

    const publishedCycle = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Template Source ${randomString('cycle')}`,
        start_date: formatDateKey(publishedStart),
        end_date: formatDateKey(publishedEnd),
        published: true,
      })
      .select('id')
      .single()
    if (publishedCycle.error || !publishedCycle.data) {
      throw new Error(publishedCycle.error?.message ?? 'Could not create template source cycle.')
    }

    const draftCycle = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Template Target ${randomString('cycle')}`,
        start_date: formatDateKey(draftStart),
        end_date: formatDateKey(draftEnd),
        published: false,
      })
      .select('id, start_date')
      .single()
    if (draftCycle.error || !draftCycle.data) {
      throw new Error(draftCycle.error?.message ?? 'Could not create template target cycle.')
    }

    createdCycleIds.push(publishedCycle.data.id, draftCycle.data.id)

    const sourceShifts = await supabase.from('shifts').insert([
      {
        cycle_id: publishedCycle.data.id,
        user_id: lead.id,
        date: formatDateKey(publishedStart),
        shift_type: 'day',
        role: 'lead',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: publishedCycle.data.id,
        user_id: staff.id,
        date: formatDateKey(addDays(publishedStart, 2)),
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
    ])
    if (sourceShifts.error) {
      throw new Error(sourceShifts.error.message)
    }

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      lead: { id: lead.id, fullName: leadFullName },
      staff: { id: staff.id, fullName: staffFullName },
      publishedCycleId: publishedCycle.data.id,
      draftCycleId: draftCycle.data.id,
      draftStartDate: draftCycle.data.start_date,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    if (createdTemplateNames.length > 0) {
      await ctx.supabase.from('cycle_templates').delete().in('name', createdTemplateNames)
    }
    await ctx.supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('schedule_cycles').delete().in('id', createdCycleIds)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('manager saves a published cycle as a template and applies it to a draft', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run cycle-template e2e.')

    const templateName = `E2E Template ${randomString('template')}`
    createdTemplateNames.push(templateName)

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.publishedCycleId}&view=week&shift=day`)
    await expect(page.getByRole('heading', { name: 'Coverage' })).toBeVisible()

    await page.locator('#main-content details summary').click()
    await page.getByText('Save as template', { exact: true }).click()
    await expect(page.getByRole('dialog', { name: /Save as template/i })).toBeVisible()
    await page.getByLabel('Template name').fill(templateName)
    await page.getByLabel('Description').fill('Saved by Playwright from a published cycle.')
    await page.getByRole('button', { name: 'Save template' }).click()
    await expect(page.getByText('Template saved.')).toBeVisible({ timeout: 15_000 })

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('cycle_templates')
            .select('id, shift_data')
            .eq('name', templateName)
            .maybeSingle()
          if (result.error) throw new Error(result.error.message)
          return Array.isArray(result.data?.shift_data) ? result.data.shift_data.length : 0
        },
        { timeout: 20_000 }
      )
      .toBe(2)

    await page.goto(`/coverage?cycle=${ctx!.draftCycleId}&view=week&shift=day`)
    await expect(page.getByText('No shifts assigned yet', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Start from template' }).click()
    await expect(page.getByRole('dialog', { name: /Start from template/i })).toBeVisible()
    await expect(page.getByText(templateName)).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Apply template' }).click()

    await expect(page).toHaveURL(/success=template_applied/, { timeout: 30_000 })

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('shifts')
            .select('user_id, date, role')
            .eq('cycle_id', ctx!.draftCycleId)
            .order('date', { ascending: true })
          if (result.error) throw new Error(result.error.message)
          return (result.data ?? [])
            .map((row) => `${row.user_id}:${row.date}:${row.role}`)
            .join('|')
        },
        { timeout: 20_000 }
      )
      .toBe(
        [
          `${ctx!.lead.id}:${ctx!.draftStartDate}:lead`,
          `${ctx!.staff.id}:${formatDateKey(addDays(new Date(`${ctx!.draftStartDate}T00:00:00`), 2))}:staff`,
        ].join('|')
      )
  })
})
