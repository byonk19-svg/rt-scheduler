import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
}

import { loginAs } from './helpers/auth'
import { randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

test.describe.serial('/directory redirect behavior', () => {
  test.setTimeout(60_000)
  let ctx: TestContext | null = null

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('dir-redir-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'E2E Directory Redirect Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
      maxWorkDaysPerWeek: 3,
    })

    ctx = {
      supabase,
      manager: {
        id: manager.id,
        email: managerEmail,
        password: managerPassword,
      },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return
    await ctx.supabase.auth.admin.deleteUser(ctx.manager.id)
  })

  test('unauthenticated /directory request lands on /login', async ({ page }) => {
    await page.goto('/directory')
    await expect(page).toHaveURL(/\/login(?:[/?].*)?$/)
  })

  test('authenticated manager /directory request lands on /team', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/directory', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/team(?:[/?].*)?$/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Managers' })).toBeVisible()
  })
})
