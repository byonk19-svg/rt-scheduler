import type { Page } from '@playwright/test'

export async function gotoWithRetry(page: Page, url: string) {
  let lastError: unknown

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      return
    } catch (error) {
      lastError = error
      await page.waitForTimeout(500 * (attempt + 1))
    }
  }

  throw lastError
}
