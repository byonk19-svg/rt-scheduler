import { expect, test } from '@playwright/test'

test('login page renders', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Teamwise Scheduling')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
})

test('signup page renders', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.getByText('Join Teamwise to manage schedules and coverage.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request Access' })).toBeVisible()
})
