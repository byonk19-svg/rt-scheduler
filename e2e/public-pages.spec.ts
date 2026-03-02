import { expect, test } from '@playwright/test'

test('login page renders', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
})

test('signup page renders', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.getByText('Join Teamwise to manage schedules and coverage.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request Access' })).toBeVisible()
})
