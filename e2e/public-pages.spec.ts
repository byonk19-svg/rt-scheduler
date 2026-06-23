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
  await main.getByRole('link', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/login(?:[/?].*)?$/)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.locator('#main-content').getByRole('link', { name: 'Request access' }).click()
  await expect(page).toHaveURL(/\/signup(?:[/?].*)?$/)
  await expect(page.getByRole('heading', { name: 'Request access' })).toBeVisible()
})

test('login page renders', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
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
