import { expect, test } from '@playwright/test'

import { randomString } from './helpers/env'
import { gotoWithRetry } from './helpers/navigation'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

test('authenticated user can login and sign out', async ({ page }) => {
  test.setTimeout(60_000)

  const supabase = createServiceRoleClientOrNull()
  test.skip(!supabase, 'Supabase service env values are required to run auth flow test.')

  const email = `${randomString('auth-flow')}@example.com`
  const password = `Auth!${Math.random().toString(16).slice(2, 10)}`
  const user = await createE2EUser(supabase!, {
    email,
    password,
    fullName: 'Auth Flow Manager',
    role: 'manager',
    employmentType: 'full_time',
    shiftType: 'day',
    isLeadEligible: true,
  })

  try {
    await page.goto('/login')
    await page.getByLabel(/^Email address$/).fill(email)
    await page.getByLabel(/^Password$/).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible({ timeout: 30_000 })

    await gotoWithRetry(page, '/auth/signout?next=/login')
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 })
  } finally {
    await supabase!.auth.admin.deleteUser(user.id).catch(() => undefined)
  }
})
