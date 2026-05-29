import { expect, test } from '@playwright/test'

import { loginAs } from './helpers/auth'
import { randomString } from './helpers/env'
import { gotoWithRetry } from './helpers/navigation'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

test.describe.serial('lottery workflow surface', () => {
  test.setTimeout(120_000)

  let manager: { id: string; email: string; password: string } | null = null
  const supabase = createServiceRoleClientOrNull()

  test.beforeAll(async () => {
    if (!supabase) return

    const email = `${randomString('lottery-mgr')}@example.com`
    const password = `Lottery!${Math.random().toString(16).slice(2, 10)}`
    const created = await createE2EUser(supabase, {
      email,
      password,
      fullName: 'Lottery Surface Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    manager = { id: created.id, email, password }
  })

  test.afterAll(async () => {
    if (!supabase || !manager) return
    await supabase.auth.admin.deleteUser(manager.id).catch(() => undefined)
  })

  test('manager can open Lottery from Schedule navigation after the dashboard', async ({
    page,
  }) => {
    test.skip(!supabase || !manager, 'Supabase service env values are required for lottery e2e.')

    await loginAs(page, manager!.email, manager!.password)
    await page.goto('/dashboard/manager')

    await expect(page.getByRole('heading', { name: 'Manager Dashboard' })).toBeVisible()

    await gotoWithRetry(page, '/coverage')
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})

    const mainNav = page.getByRole('navigation', { name: 'Main navigation' })
    const lotteryLink = mainNav.getByRole('link', { name: 'Lottery' })
    await expect(lotteryLink).toBeVisible()
    await expect(lotteryLink).toHaveAttribute('href', '/lottery')

    const lotteryHref = await lotteryLink.getAttribute('href')
    expect(lotteryHref).toBe('/lottery')
    await gotoWithRetry(page, lotteryHref!)
    await expect(page).toHaveURL(/\/lottery(?:[/?].*)?$/)
    await expect(page.getByRole('heading', { name: 'Lottery Decision Center' })).toBeVisible()
    await expect(
      page.getByText(
        'Review the live Schedule shift, volunteers, and recommendation before applying a staff reduction.'
      )
    ).toBeVisible()

    await expect(lotteryLink).toHaveAttribute('aria-current', 'page')
  })
})
