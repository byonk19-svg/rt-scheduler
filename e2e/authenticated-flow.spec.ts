import { expect, test } from '@playwright/test'

const email = process.env.E2E_USER_EMAIL
const password = process.env.E2E_USER_PASSWORD

test('authenticated user can login and sign out', async ({ page }) => {
  test.skip(!email || !password, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run auth flow test.')

  await page.goto('/login')
  await page.getByLabel(/^Email address$/).fill(email!)
  await page.getByLabel(/^Password$/).fill(password!)
  await page.getByRole('button', { name: 'Sign In' }).click()

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
  const logoutButton = page.getByRole('button', { name: 'Log out' })
  await expect(logoutButton).toBeVisible({ timeout: 30_000 })

  await page.goto('/auth/signout?next=/login', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 })
})
