import { expect, test } from '@playwright/test'

test('login page renders', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
})

test('signup page renders', async ({ page }) => {
  await page.goto('/signup', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
})
