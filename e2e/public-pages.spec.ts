import { expect, test } from '@playwright/test'

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

async function expectTouchSafe(locator: import('@playwright/test').Locator) {
  const box = await locator.boundingBox()
  expect(box, 'expected visible touch target').not.toBeNull()
  expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44)
  expect(Math.round(box!.width)).toBeGreaterThanOrEqual(44)
}

test('landing page exposes public navigation', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('heading', { name: 'Scheduling that keeps care moving.' })
  ).toBeVisible()

  const main = page.locator('#main-content')
  await main.getByRole('link', { name: 'Sign in' }).click({ noWaitAfter: true })
  await expect(page).toHaveURL(/\/login(?:[/?].*)?$/)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page
    .locator('#main-content')
    .getByRole('link', { name: 'Request access' })
    .click({ noWaitAfter: true })
  await expect(page).toHaveURL(/\/signup(?:[/?].*)?$/)
  await expect(page.getByRole('heading', { name: 'Request access' })).toBeVisible()
})

test('login page renders', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
})

test('password reset submits a generic reset-link request', async ({ page }) => {
  const recoverRequests: string[] = []
  const recoverHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
  }

  await page.route('**/auth/v1/recover**', async (route) => {
    if (route.request().method() === 'POST') {
      recoverRequests.push(route.request().postData() ?? '')
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: recoverHeaders,
      body: '{}',
    })
  })

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: 'Forgot password?' }).click({ noWaitAfter: true })
  await expect(page).toHaveURL(/\/reset-password(?:[/?].*)?$/)
  await page.goto('/reset-password', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible()

  await page.getByLabel('Email address').fill('casey@example.test')
  await page.getByRole('button', { name: 'Send reset link' }).click()

  await expect(page.getByText(/If an account exists for that email/i)).toBeVisible()
  await expect.poll(() => recoverRequests.length).toBe(1)
  expect(recoverRequests[0]).toContain('casey@example.test')

  await page
    .locator('#main-content')
    .getByRole('link', { name: 'Back to sign in' })
    .click({ noWaitAfter: true })
  await expect(page).toHaveURL(/\/login(?:[/?].*)?$/)
})

test('signup page renders', async ({ page }) => {
  await page.goto('/signup', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Request access' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit request' })).toBeVisible()
})

test('public auth pages keep mobile controls touch-safe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
  await expectNoHorizontalOverflow(page)
  await expectTouchSafe(page.getByRole('link', { name: 'Home' }))
  await expectTouchSafe(page.getByRole('link', { name: 'Request access' }).first())
  await expectTouchSafe(page.getByRole('button', { name: 'Sign in' }))
  await expectTouchSafe(page.getByLabel('Email address'))
  await expectTouchSafe(page.getByRole('textbox', { name: 'Password' }))

  const loginPassword = page.getByRole('textbox', { name: 'Password' })
  await expect(loginPassword).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(loginPassword).toHaveAttribute('type', 'text')

  await page.goto('/signup', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
  await expectNoHorizontalOverflow(page)
  await expectTouchSafe(page.getByRole('link', { name: 'Home' }))
  await expectTouchSafe(page.getByRole('link', { name: 'Sign in' }).first())
  await expectTouchSafe(page.getByRole('button', { name: 'Submit request' }))
  await expectTouchSafe(page.getByLabel('First name'))
  await expectTouchSafe(page.getByLabel('Last name'))

  const firstNameBox = await page.getByLabel('First name').boundingBox()
  const lastNameBox = await page.getByLabel('Last name').boundingBox()
  expect(firstNameBox, 'first name input should be visible').not.toBeNull()
  expect(lastNameBox, 'last name input should be visible').not.toBeNull()
  expect(Math.round(lastNameBox!.y)).toBeGreaterThan(Math.round(firstNameBox!.y))

  const signupPassword = page.getByRole('textbox', { name: 'Password' })
  await expect(signupPassword).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(signupPassword).toHaveAttribute('type', 'text')
})
