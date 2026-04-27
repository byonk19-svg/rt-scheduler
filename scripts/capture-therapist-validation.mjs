/**
 * Capture therapist workflow screenshots with an automation-only auth path.
 *
 * Preferred behavior:
 * 1. Try repo-local SHOT_STAFF_EMAIL / SHOT_PASSWORD if present and valid.
 * 2. If that fails, create a temporary therapist user with the service-role key,
 *    authenticate Playwright via Supabase SSR cookies, capture the therapist routes,
 *    then delete the temporary user.
 *
 * Run:
 *   node --env-file=.env.local scripts/capture-therapist-validation.mjs
 *
 * Output:
 *   artifacts/therapist-validation/<timestamp>/
 *   artifacts/therapist-validation/latest/
 */

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseURL = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
const therapistEmail = process.env.SHOT_STAFF_EMAIL ?? 'demo-therapist01@teamwise.test'
const therapistPassword = process.env.SHOT_PASSWORD ?? 'Teamwise123!'

const ROUTES = [
  { name: 'therapist-settings', path: '/therapist/settings' },
  { name: 'therapist-recurring-pattern', path: '/therapist/recurring-pattern' },
  { name: 'therapist-future-availability', path: '/therapist/availability' },
]

function cacheBustRelPath(relPath) {
  const ts = Date.now()
  const sep = relPath.includes('?') ? '&' : '?'
  return `${relPath}${sep}_shot=${ts}`
}

function createCookieJar() {
  /** @type {Map<string, { value: string, options: Record<string, unknown> }>} */
  const byName = new Map()
  return {
    getAll() {
      return [...byName.entries()].map(([name, row]) => ({ name, value: row.value }))
    },
    setAll(cookiesToSet) {
      for (const cookie of cookiesToSet) {
        if (cookie.value) {
          byName.set(cookie.name, { value: cookie.value, options: cookie.options ?? {} })
        } else {
          byName.delete(cookie.name)
        }
      }
    },
    entries() {
      return [...byName.entries()]
    },
  }
}

function toPlaywrightCookies(jarEntries) {
  const { hostname } = new URL(baseURL)
  const host = hostname === '127.0.0.1' ? '127.0.0.1' : hostname

  return jarEntries.map(([name, row]) => {
    const c = {
      name,
      value: row.value,
      domain: host,
      path: typeof row.options.path === 'string' ? row.options.path : '/',
      httpOnly: Boolean(row.options.httpOnly),
      secure: Boolean(row.options.secure),
    }
    const sameSite = row.options.sameSite
    if (sameSite === 'none' || sameSite === 'None') c.sameSite = 'None'
    else if (sameSite === 'strict' || sameSite === 'Strict') c.sameSite = 'Strict'
    else c.sameSite = 'Lax'

    if (typeof row.options.maxAge === 'number' && Number.isFinite(row.options.maxAge)) {
      c.expires = Math.round(Date.now() / 1000) + row.options.maxAge
    }
    return c
  })
}

async function signInWithPassword(email, password) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }

  const jar = createCookieJar()
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (cookiesToSet) => jar.setAll(cookiesToSet),
    },
  })

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Supabase sign-in failed for ${email}: ${error.message}`)

  return jar.entries()
}

async function createTemporaryTherapist() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const suffix = crypto.randomBytes(4).toString('hex')
  const email = `codex-therapist-${suffix}@example.com`
  const password = `Ther!${suffix}Aa1`
  const fullName = 'Codex Therapist Visual Validation'

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? 'Could not create temporary therapist user.')
  }

  const userId = created.data.user.id
  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: userId,
      full_name: fullName,
      email,
      role: 'therapist',
      shift_type: 'day',
      employment_type: 'full_time',
      max_work_days_per_week: 3,
      preferred_work_days: [],
      is_lead_eligible: false,
      on_fmla: false,
      is_active: true,
      site_id: 'default',
    },
    { onConflict: 'id' }
  )
  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    throw new Error(profileError.message)
  }

  return { admin, userId, email, password }
}

async function attachSession(context, cookieEntries, outDir, label) {
  await context.addCookies(toPlaywrightCookies(cookieEntries))
  const page = await context.newPage()
  const probeUrl = `${baseURL}${cacheBustRelPath('/therapist/settings')}`
  let lastError = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(probeUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      if (/\/login/i.test(page.url())) {
        throw new Error(`Redirected to login on auth probe (${label}).`)
      }
      return page
    } catch (error) {
      lastError = error
      await page.waitForTimeout(1500)
    }
  }

  if (/\/login/i.test(page.url())) {
    const snap = path.join(outDir, `_session-failed-${label}.png`)
    await page.screenshot({ path: snap, fullPage: true })
    throw new Error(`Session cookies did not authenticate (${label}). See ${snap}.`)
  }
  throw lastError ?? new Error(`Could not open therapist auth probe (${label}).`)
}

async function capture(page, outDir, name, relPath) {
  const fullUrl = `${baseURL}${cacheBustRelPath(relPath)}`
  await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 90_000 }).catch(async () => {
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  })
  await page.waitForTimeout(1200)
  const file = path.join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  const text = await page
    .locator('body')
    .innerText()
    .catch(() => '')
  return { file, text: text.slice(0, 800), url: page.url() }
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = path.join(process.cwd(), 'artifacts', 'therapist-validation', stamp)
  await fs.mkdir(outDir, { recursive: true })

  let tempUser = null
  let authLabel = 'seeded-staff'
  let cookieEntries

  try {
    cookieEntries = await signInWithPassword(therapistEmail, therapistPassword)
  } catch (error) {
    console.warn(
      `Seeded therapist auth failed: ${error instanceof Error ? error.message : String(error)}`
    )
    tempUser = await createTemporaryTherapist()
    cookieEntries = await signInWithPassword(tempUser.email, tempUser.password)
    authLabel = 'temporary-therapist'
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  })

  try {
    const page = await attachSession(context, cookieEntries, outDir, authLabel)
    const summary = {
      baseURL,
      authLabel,
      routes: [],
    }

    for (const route of ROUTES) {
      const captured = await capture(page, outDir, route.name, route.path)
      summary.routes.push({
        name: route.name,
        path: route.path,
        url: captured.url,
        screenshot: captured.file,
        snippet: captured.text,
      })
      console.log('Wrote', captured.file)
    }

    const summaryPath = path.join(outDir, 'summary.json')
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2))

    const latestDir = path.join(process.cwd(), 'artifacts', 'therapist-validation', 'latest')
    await fs.rm(latestDir, { recursive: true, force: true })
    await fs.cp(outDir, latestDir, { recursive: true })

    console.log(`\nDone. This run: ${outDir}`)
    console.log(`Mirror (always newest): ${latestDir}`)
  } finally {
    await context.close()
    await browser.close()
    if (tempUser) {
      await tempUser.admin.auth.admin.deleteUser(tempUser.userId)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
