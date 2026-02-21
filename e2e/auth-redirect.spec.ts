import { expect, test } from '@playwright/test'

const protectedRoutes = ['/dashboard', '/availability', '/schedule', '/shift-board']

for (const route of protectedRoutes) {
  test(`redirects unauthenticated request from ${route} to /login`, async ({ page }) => {
    await page.goto(route)
    await expect(page).toHaveURL(/\/login/)
  })
}
