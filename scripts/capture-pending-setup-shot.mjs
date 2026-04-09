import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const baseURL = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')

function cacheBust(relPath) {
  const sep = relPath.includes('?') ? '&' : '?'
  return `${relPath}${sep}_shot=${Date.now()}`
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = path.join(process.cwd(), 'artifacts', 'screen-capture', stamp)
  await fs.mkdir(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const email = process.env.SHOT_STAFF_EMAIL ?? 'demo-therapist01@teamwise.test'
  const password = process.env.SHOT_PASSWORD ?? 'Teamwise123!'

  const { data: profileRow, error: profileError } = await admin
    .from('profiles')
    .select('id, role')
    .eq('email', email)
    .maybeSingle()
  if (profileError || !profileRow?.id) {
    throw new Error(`Could not load profile for ${email}: ${profileError?.message ?? 'not found'}`)
  }

  const originalRole = profileRow.role

  try {
    const { error: toPendingError } = await admin
      .from('profiles')
      .update({ role: null })
      .eq('id', profileRow.id)
    if (toPendingError) throw new Error(`Failed to set pending role: ${toPendingError.message}`)

    await page.goto(`${baseURL}${cacheBust('/login')}`, {
      waitUntil: 'networkidle',
      timeout: 90000,
    })
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button:has-text("Sign in")')
    await page.waitForTimeout(7000)
    const postLoginUrl = page.url()
    if (!postLoginUrl.includes('/pending-setup')) {
      const failPath = path.join(outDir, '05-pending-setup-failed.png')
      await page.screenshot({ path: failPath, fullPage: true })
      const bodyText = await page.textContent('body')
      throw new Error(
        `Did not reach pending setup. URL: ${postLoginUrl}. Failure screenshot: ${failPath}. Body excerpt: ${(bodyText ?? '').slice(0, 500)}`
      )
    }
    await page.waitForTimeout(1200)

    const shotPath = path.join(outDir, '05-pending-setup.png')
    await page.screenshot({ path: shotPath, fullPage: true })

    const latestDir = path.join(process.cwd(), 'artifacts', 'screen-capture', 'latest')
    await fs.mkdir(latestDir, { recursive: true })
    await fs.copyFile(shotPath, path.join(latestDir, '05-pending-setup.png'))

    console.log(`Wrote ${shotPath}`)
    console.log(`Mirror ${path.join(latestDir, '05-pending-setup.png')}`)
  } finally {
    const { error: restoreError } = await admin
      .from('profiles')
      .update({ role: originalRole })
      .eq('id', profileRow.id)
    if (restoreError) {
      console.error(`Failed to restore original role for ${email}: ${restoreError.message}`)
    }
  }

  await context.close()
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
