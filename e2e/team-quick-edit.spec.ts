import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  therapist: { id: string; fullName: string }
  secondaryTherapist: { id: string; fullName: string }
}

test.describe.serial('/team quick edit modal', () => {
  test.setTimeout(90_000)
  let ctx: TestContext | null = null
  const createdUserIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('team-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'E2E Team Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const therapistFullName = `E2E Team Therapist ${randomString('ther')}`
    const therapist = await createE2EUser(supabase, {
      email: `${randomString('team-ther')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    const secondaryTherapistFullName = `E2E Team Secondary ${randomString('ther')}`
    const secondaryTherapist = await createE2EUser(supabase, {
      email: `${randomString('team-ther2')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: secondaryTherapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    createdUserIds.push(manager.id, therapist.id, secondaryTherapist.id)
    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      therapist: { id: therapist.id, fullName: therapistFullName },
      secondaryTherapist: { id: secondaryTherapist.id, fullName: secondaryTherapistFullName },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return
    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
  })

  test('manager can regroup, deactivate, and archive a team member from the team roster', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    const updatedName = `${ctx!.therapist.fullName} Updated`

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/team')

    await expect(page.getByRole('heading', { name: 'Managers' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Day Shift' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Night Shift' })).toBeVisible()

    await page.getByRole('button').filter({ hasText: ctx!.therapist.fullName }).first().click()

    const dialog = page.getByRole('dialog', { name: 'Quick Edit Team Member' })
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    await expect(dialog.getByText('Coverage lead')).toHaveCount(0)

    await dialog.getByLabel('Name').fill(updatedName)
    await dialog.getByLabel('Role').selectOption('lead')
    await dialog.getByLabel('Shift').selectOption('night')
    await dialog.getByLabel('Employment Type').selectOption('part_time')
    await dialog.getByLabel('On FMLA').check()
    await dialog.getByLabel('FMLA Return Date').fill('2026-05-12')
    await dialog.getByRole('button', { name: 'Save changes' }).click()

    await expect(page).toHaveURL(/\/team\?success=profile_saved/, { timeout: 15_000 })
    await expect(page.getByRole('alert').filter({ hasText: 'Team member updated.' })).toBeVisible()

    const updatedCard = page.getByRole('button').filter({ hasText: updatedName }).first()
    await expect(updatedCard).toBeVisible()
    await expect(updatedCard).toContainText('Lead Therapist')
    await expect(updatedCard).toContainText('Night shift')
    await expect(updatedCard).toContainText('Part-time')
    await expect(updatedCard).toContainText('Return May 12, 2026')

    await updatedCard.click()
    const inactiveDialog = page.getByRole('dialog', { name: 'Quick Edit Team Member' })
    await inactiveDialog.getByLabel('Active').uncheck()
    await inactiveDialog.getByRole('button', { name: 'Save changes' }).click()

    await expect(page).toHaveURL(/\/team\?success=profile_saved/, { timeout: 15_000 })
    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('profiles')
          .select('is_active')
          .eq('id', ctx!.therapist.id)
          .single()
        if (result.error) throw new Error(result.error.message)
        return result.data?.is_active
      })
      .toBe(false)

    await page.goto(`/team?edit_profile=${ctx!.therapist.id}`)
    const archiveDialog = page.getByRole('dialog', { name: 'Quick Edit Team Member' })
    await expect(archiveDialog).toBeVisible({ timeout: 10_000 })
    await expect(archiveDialog.getByText('No app access while inactive.')).toBeVisible()
    await expect(
      archiveDialog.getByText('This updates automatically from the selected role.')
    ).toHaveCount(0)
    await archiveDialog.getByRole('button', { name: 'Archive employee' }).click()

    await expect(page).toHaveURL(/\/team\?success=profile_archived/, { timeout: 15_000 })
    await expect(page.getByRole('button').filter({ hasText: updatedName })).toHaveCount(0)

    const result = await ctx!.supabase
      .from('profiles')
      .select(
        'full_name, role, shift_type, employment_type, is_lead_eligible, on_fmla, fmla_return_date, is_active, archived_at, archived_by'
      )
      .eq('id', ctx!.therapist.id)
      .single()

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      full_name: updatedName,
      role: 'lead',
      shift_type: 'night',
      employment_type: 'part_time',
      is_lead_eligible: true,
      on_fmla: true,
      fmla_return_date: '2026-05-12',
      is_active: false,
      archived_by: ctx!.manager.id,
    })
    expect(result.data?.archived_at).toBeTruthy()
  })

  test('active quick edit keeps archive unavailable and role access checklist updates live', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/team?edit_profile=${ctx!.secondaryTherapist.id}`)

    const dialog = page.getByRole('dialog', { name: 'Quick Edit Team Member' })
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    await expect(dialog.getByRole('button', { name: 'Archive employee' })).toHaveCount(0)
    await expect(
      dialog.getByText('This updates automatically from the selected role.')
    ).toBeVisible()

    await dialog.getByLabel('Role').selectOption('therapist')
    await expect(
      dialog
        .locator('div')
        .filter({ hasText: /^Approve swapsNo$/ })
        .first()
    ).toBeVisible()

    await dialog.getByLabel('Role').selectOption('manager')
    await expect(
      dialog
        .locator('div')
        .filter({ hasText: /^Approve swapsYes$/ })
        .first()
    ).toBeVisible()
  })

  test('on-fmla can be cleared and removes return date from profile', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    const returnDate = '2026-06-01'

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/team?edit_profile=${ctx!.secondaryTherapist.id}`)

    const dialog = page.getByRole('dialog', { name: 'Quick Edit Team Member' })
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    await dialog.getByLabel('On FMLA').check()
    await dialog.getByLabel('FMLA Return Date').fill(returnDate)
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/\/team\?success=profile_saved/, { timeout: 15_000 })

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('profiles')
          .select('on_fmla, fmla_return_date')
          .eq('id', ctx!.secondaryTherapist.id)
          .single()
        if (result.error) throw new Error(result.error.message)
        return result.data
      })
      .toMatchObject({
        on_fmla: true,
        fmla_return_date: returnDate,
      })

    await page.goto(`/team?edit_profile=${ctx!.secondaryTherapist.id}`)
    const updatedDialog = page.getByRole('dialog', { name: 'Quick Edit Team Member' })
    await expect(updatedDialog).toBeVisible({ timeout: 10_000 })
    await updatedDialog.getByLabel('On FMLA').uncheck()
    await updatedDialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/\/team\?success=profile_saved/, { timeout: 15_000 })

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('profiles')
          .select('on_fmla, fmla_return_date')
          .eq('id', ctx!.secondaryTherapist.id)
          .single()
        if (result.error) throw new Error(result.error.message)
        return result.data
      })
      .toMatchObject({
        on_fmla: false,
        fmla_return_date: null,
      })
  })
})
