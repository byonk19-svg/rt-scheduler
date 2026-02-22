import { expect, test } from '@playwright/test'

const protectedRoutes = [
  '/dashboard',
  '/dashboard/manager',
  '/dashboard/staff',
  '/availability',
  '/schedule',
  '/shift-board',
  '/profile',
]

for (const route of protectedRoutes) {
  test(`redirects unauthenticated request from ${route} to /login`, async ({ page }) => {
    await page.goto(route)
    await expect(page).toHaveURL(/\/login/)
  })
}
