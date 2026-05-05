import { expect, test } from '@playwright/test'

import { loginAs } from './helpers/auth'
import { randomString } from './helpers/env'
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

  test('manager can open Lottery from the dashboard and keep Schedule navigation active', async ({
    page,
  }) => {
    test.skip(!supabase || !manager, 'Supabase service env values are required for lottery e2e.')

    await loginAs(page, manager!.email, manager!.password)
    await page.goto('/dashboard/manager')

    await expect(page.getByRole('heading', { name: 'Manager Dashboard' })).toBeVisible()
    const openLotteryLink = page.getByRole('link', { name: 'Open Lottery' }).first()
    await expect(openLotteryLink).toBeVisible()
    await expect(openLotteryLink).toHaveAttribute('href', '/lottery')

    await openLotteryLink.scrollIntoViewIfNeeded()
    await Promise.all([
      page.waitForURL(/\/lottery(?:[/?].*)?$/, { timeout: 30_000 }),
      openLotteryLink.click(),
    ])
    await expect(page.getByRole('heading', { name: 'Lottery' })).toBeVisible()
    await expect(
      page.getByText(
        'Preview low-census reductions, track request order, and apply the result against the live published schedule.'
      )
    ).toBeVisible()

    const scheduleMainNavLink = page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Schedule' })
    await expect(scheduleMainNavLink).toHaveAttribute('aria-current', 'page')

    const scheduleNav = page.getByRole('navigation', { name: 'Schedule section navigation' })
    const scheduleLotteryLink = scheduleNav.getByRole('link', { name: 'Lottery' })
    await expect(scheduleLotteryLink).toBeVisible()
    await expect(scheduleLotteryLink).toHaveAttribute('href', '/lottery')
    await expect(scheduleLotteryLink).toHaveAttribute('aria-current', 'page')
  })
})
