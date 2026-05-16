import { expect, test, type Locator, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { randomString } from './helpers/env'
import { gotoWithRetry } from './helpers/navigation'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  therapist: { id: string; fullName: string }
  secondaryTherapist: { id: string; fullName: string }
  rolePreviewTherapist: { id: string; fullName: string }
}

async function openQuickEditByDeepLink(page: Page, profileId: string) {
  const dialog = page.getByRole('dialog', { name: 'Quick Edit Team Member' })

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(`/team?edit_profile=${profileId}&_e2e=${Date.now()}`, {
      waitUntil: 'load',
    })
    if (await dialog.isVisible({ timeout: 10_000 }).catch(() => false)) {
      return dialog
    }
  }

  await expect(dialog).toBeVisible({ timeout: 30_000 })
  return dialog
}

async function openQuickEditFromDirectorySearch(page: Page, profileName: string) {
  const dialog = page.getByRole('dialog', { name: 'Quick Edit Team Member' })

  await gotoWithRetry(page, '/team')
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined)
  const searchInput = page.getByLabel('Search')
  await expect(searchInput).toBeVisible({ timeout: 20_000 })
  await searchInput.fill('')
  await searchInput.pressSequentially(profileName)
  await expect(searchInput).toHaveValue(profileName)
  await expect(page.getByText('Filtered view')).toBeVisible({ timeout: 10_000 })
  const profileCard = page.getByRole('button').filter({ hasText: profileName }).first()
  await expect(profileCard).toBeVisible({ timeout: 20_000 })
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await profileCard.scrollIntoViewIfNeeded()
    await profileCard.click({ timeout: 5_000 }).catch(async () => {
      await profileCard.evaluate((element: HTMLElement) => element.click())
    })
    if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      return dialog
    }
    await page.waitForTimeout(750)
  }
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  return dialog
}

async function expectQuickEditValues(
  dialog: Locator,
  expected: {
    name: string
    role: 'manager' | 'lead' | 'therapist'
    shift: 'day' | 'night'
    employment: 'full_time' | 'part_time' | 'prn'
    active: boolean
    onFmla: boolean
    fmlaReturnDate?: string
  }
) {
  await expect(dialog.getByLabel('Name')).toHaveValue(expected.name)
  await expect(dialog.getByLabel('Role')).toHaveValue(expected.role)
  await expect(dialog.getByLabel('Shift')).toHaveValue(expected.shift)
  await expect(dialog.getByLabel('Employment Type')).toHaveValue(expected.employment)

  if (expected.active) {
    await expect(dialog.getByLabel('Active')).toBeChecked()
  } else {
    await expect(dialog.getByLabel('Active')).not.toBeChecked()
  }

  if (expected.onFmla) {
    await expect(dialog.getByLabel('On FMLA')).toBeChecked()
  } else {
    await expect(dialog.getByLabel('On FMLA')).not.toBeChecked()
  }
  await expect(dialog.getByLabel('FMLA Return Date')).toHaveValue(expected.fmlaReturnDate ?? '')
}

test.describe.serial('/team quick edit modal', () => {
  test.setTimeout(180_000)
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

    const rolePreviewTherapistFullName = `E2E Team Role Preview ${randomString('ther')}`
    const rolePreviewTherapist = await createE2EUser(supabase, {
      email: `${randomString('team-ther3')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: rolePreviewTherapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    createdUserIds.push(manager.id, therapist.id, secondaryTherapist.id, rolePreviewTherapist.id)
    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      therapist: { id: therapist.id, fullName: therapistFullName },
      secondaryTherapist: { id: secondaryTherapist.id, fullName: secondaryTherapistFullName },
      rolePreviewTherapist: {
        id: rolePreviewTherapist.id,
        fullName: rolePreviewTherapistFullName,
      },
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
    const secondaryUpdatedName = `${ctx!.secondaryTherapist.fullName} Updated`

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await gotoWithRetry(page, '/team')

    await expect(page.getByRole('tab', { name: 'Directory' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Managers' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Day shift therapists' })).toBeVisible()

    const dialog = await openQuickEditByDeepLink(page, ctx!.therapist.id)
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await expect(dialog.getByText('Coverage lead')).toHaveCount(0)
    await expectQuickEditValues(dialog, {
      name: ctx!.therapist.fullName,
      role: 'therapist',
      shift: 'day',
      employment: 'full_time',
      active: true,
      onFmla: false,
    })

    await dialog.getByLabel('Name').fill(updatedName)
    await dialog.getByLabel('Role').selectOption('lead')
    await dialog.getByLabel('Shift').selectOption('night')
    await dialog.getByLabel('Employment Type').selectOption('part_time')
    await dialog.getByLabel('On FMLA').check()
    await dialog.getByLabel('FMLA Return Date').fill('2026-05-12')
    await dialog.getByRole('button', { name: 'Save changes' }).click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('profiles')
            .select('full_name, role, shift_type, employment_type, on_fmla, fmla_return_date')
            .eq('id', ctx!.therapist.id)
            .single()
          if (result.error) throw new Error(result.error.message)
          return JSON.stringify(result.data)
        },
        { timeout: 20_000 }
      )
      .toContain(updatedName)

    await gotoWithRetry(page, '/team')
    const updatedCard = page.getByRole('button').filter({ hasText: updatedName }).first()
    await expect(updatedCard).toBeVisible({ timeout: 20_000 })
    await expect(updatedCard).toContainText('Lead Therapist')
    await expect(updatedCard).toContainText('Night shift')
    await expect(updatedCard).toContainText('Part-time')
    await expect(updatedCard).toContainText('Return May 12, 2026')

    const inactiveDialog = await openQuickEditByDeepLink(page, ctx!.therapist.id)
    await expect(inactiveDialog).toBeVisible({ timeout: 30_000 })
    await expectQuickEditValues(inactiveDialog, {
      name: updatedName,
      role: 'lead',
      shift: 'night',
      employment: 'part_time',
      active: true,
      onFmla: true,
      fmlaReturnDate: '2026-05-12',
    })
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined)
    await inactiveDialog.getByLabel('Active').uncheck()
    const saveInactiveButton = inactiveDialog.getByRole('button', { name: 'Save changes' })
    await expect(saveInactiveButton).toBeEnabled()
    await saveInactiveButton.click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('profiles')
            .select('is_active')
            .eq('id', ctx!.therapist.id)
            .single()
          if (result.error) throw new Error(result.error.message)
          return result.data?.is_active
        },
        { timeout: 30_000 }
      )
      .toBe(false)

    const archiveDialog = await openQuickEditByDeepLink(page, ctx!.therapist.id)
    await expect(archiveDialog).toBeVisible({ timeout: 30_000 })
    await expectQuickEditValues(archiveDialog, {
      name: updatedName,
      role: 'lead',
      shift: 'night',
      employment: 'part_time',
      active: false,
      onFmla: true,
      fmlaReturnDate: '2026-05-12',
    })
    await expect(archiveDialog.getByText('No app access while inactive.')).toBeVisible()
    await expect(
      archiveDialog.getByText('This updates automatically from the selected role.')
    ).toHaveCount(0)
    const archiveButton = archiveDialog.getByRole('button', { name: 'Archive employee' })
    await expect(archiveButton).toBeEnabled()
    const archiveRedirect = page
      .waitForURL(/\/team\?success=profile_archived/, { timeout: 20_000 })
      .catch(() => null)
    await archiveButton.click()
    await archiveRedirect

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('profiles')
            .select(
              'full_name, role, shift_type, employment_type, is_lead_eligible, on_fmla, fmla_return_date, is_active, archived_at, archived_by'
            )
            .eq('id', ctx!.therapist.id)
            .single()
          if (result.error) throw new Error(result.error.message)
          return result.data
        },
        { timeout: 20_000 }
      )
      .toMatchObject({
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
    await expect(page.getByRole('button').filter({ hasText: updatedName })).toHaveCount(0)

    const secondaryDialog = await openQuickEditFromDirectorySearch(
      page,
      ctx!.secondaryTherapist.fullName
    )
    await expect(secondaryDialog).toBeVisible({ timeout: 30_000 })
    await expectQuickEditValues(secondaryDialog, {
      name: ctx!.secondaryTherapist.fullName,
      role: 'therapist',
      shift: 'day',
      employment: 'full_time',
      active: true,
      onFmla: false,
    })

    await secondaryDialog.getByLabel('Name').fill(secondaryUpdatedName)
    await secondaryDialog.getByLabel('Role').selectOption('manager')
    await secondaryDialog.getByLabel('Shift').selectOption('day')
    await secondaryDialog.getByLabel('Employment Type').selectOption('prn')
    await secondaryDialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/\/team\?success=profile_saved/, { timeout: 15_000 })

    const secondaryInactiveDialog = await openQuickEditFromDirectorySearch(
      page,
      secondaryUpdatedName
    )
    await expectQuickEditValues(secondaryInactiveDialog, {
      name: secondaryUpdatedName,
      role: 'manager',
      shift: 'day',
      employment: 'prn',
      active: true,
      onFmla: false,
    })
    await secondaryInactiveDialog.getByLabel('Active').uncheck()
    await secondaryInactiveDialog.getByRole('button', { name: 'Save changes' }).click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('profiles')
            .select('is_active')
            .eq('id', ctx!.secondaryTherapist.id)
            .single()
          if (result.error) throw new Error(result.error.message)
          return result.data?.is_active
        },
        { timeout: 30_000 }
      )
      .toBe(false)

    const secondaryArchiveDialog = await openQuickEditFromDirectorySearch(
      page,
      secondaryUpdatedName
    )
    await expectQuickEditValues(secondaryArchiveDialog, {
      name: secondaryUpdatedName,
      role: 'manager',
      shift: 'day',
      employment: 'prn',
      active: false,
      onFmla: false,
    })
    const secondaryArchiveRedirect = page
      .waitForURL(/\/team\?success=profile_archived/, { timeout: 20_000 })
      .catch(() => null)
    await secondaryArchiveDialog.getByRole('button', { name: 'Archive employee' }).click()
    await secondaryArchiveRedirect

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('profiles')
            .select('full_name, role, shift_type, employment_type, is_active, archived_at')
            .eq('id', ctx!.secondaryTherapist.id)
            .single()
          if (result.error) throw new Error(result.error.message)
          return result.data
        },
        { timeout: 20_000 }
      )
      .toMatchObject({
        full_name: secondaryUpdatedName,
        role: 'manager',
        shift_type: 'day',
        employment_type: 'prn',
        is_active: false,
      })
    await expect(page.getByRole('button').filter({ hasText: secondaryUpdatedName })).toHaveCount(0)
  })

  test('active quick edit keeps archive unavailable and role access checklist updates live', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/team?edit_profile=${ctx!.rolePreviewTherapist.id}`)

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
    await page.goto(`/team?edit_profile=${ctx!.rolePreviewTherapist.id}`)

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
          .eq('id', ctx!.rolePreviewTherapist.id)
          .single()
        if (result.error) throw new Error(result.error.message)
        return result.data
      })
      .toMatchObject({
        on_fmla: true,
        fmla_return_date: returnDate,
      })

    await gotoWithRetry(page, `/team?edit_profile=${ctx!.rolePreviewTherapist.id}`)
    const updatedDialog = page.getByRole('dialog', { name: 'Quick Edit Team Member' })
    await expect(updatedDialog).toBeVisible({ timeout: 10_000 })
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined)
    await updatedDialog.getByLabel('On FMLA').uncheck()
    const saveClearedFmlaButton = updatedDialog.getByRole('button', { name: 'Save changes' })
    await expect(saveClearedFmlaButton).toBeEnabled()
    await saveClearedFmlaButton.click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('profiles')
            .select('on_fmla, fmla_return_date')
            .eq('id', ctx!.rolePreviewTherapist.id)
            .single()
          if (result.error) throw new Error(result.error.message)
          return result.data
        },
        { timeout: 30_000 }
      )
      .toMatchObject({
        on_fmla: false,
        fmla_return_date: null,
      })
  })
})
