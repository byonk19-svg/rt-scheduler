import { expect, test } from '@playwright/test'

test('Next Proxy protects unmatched app routes before rendering a 404', async ({ request }) => {
  const response = await request.get('/__proxy_smoke__', { maxRedirects: 0 })

  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe('/login?redirectTo=%2F__proxy_smoke__')
})
