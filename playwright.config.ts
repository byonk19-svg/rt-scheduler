import fs from 'node:fs'
import path from 'node:path'

import { loadEnvConfig } from '@next/env'
import { defineConfig, devices } from '@playwright/test'

loadEnvConfig(process.cwd())

function loadPlaywrightEnvFile(fileName: string) {
  const envPath = path.resolve(process.cwd(), fileName)
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!match) continue

    const [, key, rawValue] = match
    if (process.env[key] != null) continue
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2')
  }
}

loadPlaywrightEnvFile(process.env.PLAYWRIGHT_ENV_FILE ?? '.env.test')

if (!process.env.CI) {
  process.env.E2E_USER_EMAIL ??= 'demo-manager@teamwise.test'
  process.env.E2E_USER_PASSWORD ??= 'Teamwise123!'
}

const port = Number(process.env.PORT ?? 3000)
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`
const workers = Number(process.env.PLAYWRIGHT_WORKERS ?? 2)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
