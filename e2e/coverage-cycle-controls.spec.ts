import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type ControlsCtx = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
}

async function openCoverageMoreMenu(page: import('@playwright/test').Page) {
  await page.getByText('More').first().click()
}

test.describe.serial('coverage cycle controls', () => {
  test.setTimeout(120_000)

  let ctx: ControlsCtx | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('controls-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 10)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Coverage Controls Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(manager.id)

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase.from('publish_events').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('notification_outbox').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('notifications').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('schedule_cycles').delete().in('id', createdCycleIds)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('manager can create and then delete a draft cycle through coverage and publish history', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run cycle-controls e2e.')

    const startDate = addDays(new Date(), 45)
    const startKey = formatDateKey(startDate)
    const endKey = formatDateKey(addDays(startDate, 41))
    const label = `Coverage Dialog ${randomString('cycle')}`

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/coverage?view=week')
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()

    await openCoverageMoreMenu(page)
    await page.getByText('New 6-week block').last().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Start date').fill(startKey)
    await dialog.getByLabel('End date').fill(endKey)
    await dialog.getByLabel('Label').fill(label)
    await dialog.getByRole('button', { name: 'Create draft block' }).click()

    let cycleId: string | null = null
    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('schedule_cycles')
            .select('id')
            .eq('label', label)
            .maybeSingle()

          if (result.error) throw new Error(result.error.message)
          cycleId = result.data?.id ?? null
          return cycleId !== null
        },
        { timeout: 20_000 }
      )
      .toBe(true)

    createdCycleIds.push(cycleId!)

    await page.goto('/publish')
    const cycleRow = page
      .locator('tr')
      .filter({ has: page.getByText(label).first() })
      .first()
    await expect(cycleRow).toBeVisible()
    await cycleRow.getByRole('button', { name: 'Delete draft' }).click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('schedule_cycles')
            .select('id')
            .eq('id', cycleId!)
            .maybeSingle()

          if (result.error) throw new Error(result.error.message)
          return result.data?.id ?? null
        },
        { timeout: 20_000 }
      )
      .toBeNull()
  })

  test('manager can auto-draft and then clear the draft from coverage', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run cycle-controls e2e.')

    const cycleDate = addDays(new Date(), 21)
    const cycleKey = formatDateKey(cycleDate)
    const cycleLabel = `Auto Draft ${randomString('cycle')}`
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: cycleLabel,
        start_date: cycleKey,
        end_date: cycleKey,
        published: false,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create auto-draft cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    const staffSpecs = [
      { role: 'lead' as const, shiftType: 'day' as const, leadEligible: true },
      { role: 'therapist' as const, shiftType: 'day' as const, leadEligible: false },
      { role: 'therapist' as const, shiftType: 'day' as const, leadEligible: false },
      { role: 'lead' as const, shiftType: 'night' as const, leadEligible: true },
      { role: 'therapist' as const, shiftType: 'night' as const, leadEligible: false },
      { role: 'therapist' as const, shiftType: 'night' as const, leadEligible: false },
    ]

    for (const [index, spec] of staffSpecs.entries()) {
      const user = await createE2EUser(ctx!.supabase, {
        email: `${randomString(`autodraft-${index}`)}@example.com`,
        password: `Staff!${Math.random().toString(16).slice(2, 10)}`,
        fullName: `Auto Draft ${index + 1}`,
        role: spec.role,
        employmentType: 'full_time',
        shiftType: spec.shiftType,
        isLeadEligible: spec.leadEligible,
      })
      createdUserIds.push(user.id)
    }

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${cycleInsert.data.id}&view=week`)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()

    await page.getByRole('button', { name: 'Auto-draft' }).click()
    const autoDialog = page.getByRole('dialog')
    await expect(autoDialog).toBeVisible()
    await autoDialog.getByRole('button', { name: 'Generate draft' }).click()

    await expect(page.getByText(/Draft generated with/i).first()).toBeVisible({
      timeout: 20_000,
    })

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('shifts')
          .select('id')
          .eq('cycle_id', cycleInsert.data.id)

        if (result.error) throw new Error(result.error.message)
        return (result.data ?? []).length
      })
      .toBeGreaterThan(0)

    await openCoverageMoreMenu(page)
    await page.getByText('Clear draft').last().click()
    const clearDialog = page.getByRole('dialog')
    await expect(clearDialog).toBeVisible()
    await clearDialog.getByRole('button', { name: 'Clear draft' }).click()
    await expect(page.getByText(/Draft cleared\. Removed/i).first()).toBeVisible({
      timeout: 20_000,
    })

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('shifts')
            .select('id')
            .eq('cycle_id', cycleInsert.data.id)

          if (result.error) throw new Error(result.error.message)
          return (result.data ?? []).length
        },
        { timeout: 20_000 }
      )
      .toBe(0)
  })
})
