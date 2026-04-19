import { expect, test } from '@playwright/test'

import { loginAs } from './helpers/auth'
import { getEnv } from './helpers/env'

test('manager navigates through inbox and schedule home', async ({ page }) => {
  const email = getEnv('E2E_USER_EMAIL') ?? 'demo-manager@teamwise.test'
  const password = getEnv('E2E_USER_PASSWORD') ?? 'Teamwise123!'

  await loginAs(page, email, password)

  await page.goto('/dashboard/manager', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Inbox', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Schedule', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'People', exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Schedule', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard\/manager\/schedule$/)
  await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Continue staffing current block' })).toBeVisible()

  await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Coverage', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Approvals', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Publish', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Availability', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Roster', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Analytics', exact: true })).toBeVisible()
})
