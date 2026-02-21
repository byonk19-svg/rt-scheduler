import { expect, test } from '@playwright/test'

test('login page renders', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('RT Scheduler')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
})

test('signup page renders', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.getByText('Join the RT Scheduler')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible()
})
