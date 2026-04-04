/**
 * Capture PNG screenshots of main app surfaces (public + manager + staff).
 *
 * Requires dev server reachable at PLAYWRIGHT_BASE_URL (default http://127.0.0.1:3000).
 * Sign-in uses Supabase password auth in Node (same cookies as the app middleware), not the React login form.
 *
 *   node --env-file=.env.local scripts/capture-all-screens.mjs
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (required for authenticated shots)
 *   PLAYWRIGHT_BASE_URL   (default http://127.0.0.1:3000 — if this points at production, shots won’t match local edits)
 *   SHOT_MANAGER_EMAIL    (default demo-manager@teamwise.test)
 *   SHOT_STAFF_EMAIL      (default demo-therapist01@teamwise.test)
 *   SHOT_PASSWORD         (default Teamwise123!)
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD — fallback if SHOT_* not set for manager
 */
import { createServerClient } from '@supabase/ssr'
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseURL = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')

/** Avoid CDN/browser serving a stale document or RSC payload during capture. */
function cacheBustRelPath(relPath) {
  const ts = Date.now()
  const sep = relPath.includes('?') ? '&' : '?'
  return `${relPath}${sep}_shot=${ts}`
}

function assertLikelyLocalDev() {
  try {
    const { hostname } = new URL(baseURL)
    const local = hostname === 'localhost' || hostname === '127.0.0.1'
    if (!local) {
      console.warn(
        `\n⚠️  PLAYWRIGHT_BASE_URL is ${baseURL} — screenshots show THAT server, not your unsaved local files.\n` +
          '   For updated UI from this repo, use: npm run dev and http://127.0.0.1:3000 (default).\n'
      )
    }
  } catch {
    /* ignore */
  }
}

const managerEmail =
  process.env.SHOT_MANAGER_EMAIL ?? process.env.E2E_USER_EMAIL ?? 'demo-manager@teamwise.test'
const staffEmail = process.env.SHOT_STAFF_EMAIL ?? 'demo-therapist01@teamwise.test'
const password = process.env.SHOT_PASSWORD ?? process.env.E2E_USER_PASSWORD ?? 'Teamwise123!'

const PUBLIC_SHOTS = [
  { name: '01-public-home', path: '/' },
  { name: '02-public-login', path: '/login' },
  { name: '03-public-signup', path: '/signup' },
  { name: '04-public-reset-password', path: '/reset-password' },
]

const MANAGER_SHOTS = [
  { name: '10-manager-dashboard', path: '/dashboard/manager' },
  { name: '11-manager-coverage-week', path: '/coverage?view=week' },
  { name: '12-manager-availability', path: '/availability' },
  { name: '13-manager-shift-board', path: '/shift-board' },
  { name: '14-manager-team', path: '/team' },
  { name: '15-manager-approvals', path: '/approvals' },
  { name: '16-manager-preliminary', path: '/preliminary' },
  { name: '17-manager-publish-history', path: '/publish' },
  { name: '18-manager-notifications', path: '/notifications' },
  { name: '19-manager-settings', path: '/settings' },
  { name: '20-manager-profile', path: '/profile' },
  { name: '21-manager-requests-new', path: '/requests/new' },
]

const STAFF_SHOTS = [
  { name: '30-staff-dashboard', path: '/dashboard/staff' },
  { name: '31-staff-coverage-week', path: '/coverage?view=week' },
  { name: '32-staff-preliminary', path: '/preliminary' },
  { name: '33-staff-future-availability', path: '/therapist/availability' },
  { name: '34-staff-shift-board', path: '/shift-board' },
  { name: '35-staff-notifications', path: '/notifications' },
  { name: '36-staff-settings', path: '/therapist/settings' },
  { name: '37-staff-profile', path: '/profile' },
]

function sanitizeFilename(name) {
  return name.replace(/[^\w\-]+/g, '_').slice(0, 120)
}

/**
 * @returns {Promise<{ name: string, value: string, options: Record<string, unknown> }[]>}
 */
async function buildAuthCookieJar(email, pwd) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anon) {
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (e.g. node --env-file=.env.local scripts/capture-all-screens.mjs)'
    )
  }
  /** @type {Map<string, { value: string, options: Record<string, unknown> }>} */
  const byName = new Map()
  const supabase = createServerClient(supabaseUrl, anon, {
    cookies: {
      getAll() {
        return [...byName.entries()].map(([name, row]) => ({ name, value: row.value }))
      },
      setAll(cookiesToSet) {
        for (const c of cookiesToSet) {
          if (c.value) {
            byName.set(c.name, { value: c.value, options: c.options ?? {} })
          } else {
            byName.delete(c.name)
          }
        }
      },
    },
  })
  const { error } = await supabase.auth.signInWithPassword({ email, password: pwd })
  if (error) throw new Error(`Supabase sign-in failed for ${email}: ${error.message}`)
  return [...byName.entries()].map(([name, row]) => ({
    name,
    value: row.value,
    options: row.options,
  }))
}

/** @param {{ name: string, value: string, options: Record<string, unknown> }[]} jar */
function toPlaywrightCookies(jar) {
  const { hostname } = new URL(baseURL)
  const host = hostname === '127.0.0.1' ? '127.0.0.1' : hostname

  return jar.map(({ name, value, options: o }) => {
    const c = {
      name,
      value,
      domain: host,
      path: typeof o.path === 'string' ? o.path : '/',
      httpOnly: Boolean(o.httpOnly),
      secure: Boolean(o.secure),
    }
    const ss = o.sameSite
    if (ss === 'none' || ss === 'None') c.sameSite = 'None'
    else if (ss === 'strict' || ss === 'Strict') c.sameSite = 'Strict'
    else c.sameSite = 'Lax'

    if (typeof o.maxAge === 'number' && Number.isFinite(o.maxAge)) {
      c.expires = Math.round(Date.now() / 1000) + o.maxAge
    }
    return c
  })
}

async function attachSession(context, email, pwd, outDir, label) {
  const jar = await buildAuthCookieJar(email, pwd)
  await context.addCookies(toPlaywrightCookies(jar))
  const page = await context.newPage()
  const dash = `${baseURL}${cacheBustRelPath('/dashboard')}`
  await page.goto(dash, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  if (/\/login/i.test(page.url())) {
    const snap = path.join(outDir, `_session-failed-${label}.png`)
    await page.screenshot({ path: snap, fullPage: true })
    throw new Error(
      `Session cookies did not authenticate (see ${snap}). Check ANON key / user exists (npm run seed:functional).`
    )
  }
  return page
}

async function capture(page, outDir, name, relPath) {
  const pathPart = relPath.startsWith('/') ? relPath : `/${relPath}`
  const url = `${baseURL}${cacheBustRelPath(pathPart)}`
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 }).catch(async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  })
  // Client-heavy App Router pages: give hydration a beat after network settles
  await page.waitForTimeout(1200)
  const file = path.join(outDir, `${sanitizeFilename(name)}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function tryPublishDetail(page, outDir) {
  try {
    await page.goto(`${baseURL}${cacheBustRelPath('/publish')}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await page.waitForTimeout(800)
    const link = page
      .locator('a[href^="/publish/"]')
      .filter({ hasNotText: /history/i })
      .first()
    const href = await link.getAttribute('href')
    if (!href || href === '/publish') return null
    const detailPath = href.startsWith('/') ? href : `/${href}`
    await page.goto(`${baseURL}${cacheBustRelPath(detailPath)}`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })
    await page.waitForTimeout(1200)
    const file = path.join(outDir, '22-manager-publish-detail.png')
    await page.screenshot({ path: file, fullPage: true })
    return file
  } catch {
    return null
  }
}

async function main() {
  assertLikelyLocalDev()

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = path.join(process.cwd(), 'artifacts', 'screen-capture', stamp)
  await fs.mkdir(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const contextOpts = {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  }
  const publicContext = await browser.newContext(contextOpts)
  const publicPage = await publicContext.newPage()

  console.log(`Base URL: ${baseURL}`)
  console.log(`Output: ${outDir}`)
  console.log(
    'Using cache-busted navigations + blocked service workers so each shot reflects a fresh document load.\n'
  )

  for (const shot of PUBLIC_SHOTS) {
    const file = await capture(publicPage, outDir, shot.name, shot.path)
    console.log('Wrote', file)
  }

  await publicContext.close()

  console.log('\n--- Manager session ---')
  const managerContext = await browser.newContext(contextOpts)
  const page = await attachSession(managerContext, managerEmail, password, outDir, 'manager')
  for (const shot of MANAGER_SHOTS) {
    const file = await capture(page, outDir, shot.name, shot.path)
    console.log('Wrote', file)
  }
  const detail = await tryPublishDetail(page, outDir)
  if (detail) console.log('Wrote', detail)
  else console.log('Skipped publish detail (no row/link)')

  await managerContext.close()

  const staffContext = await browser.newContext(contextOpts)

  console.log('\n--- Staff session ---')
  const page2 = await attachSession(staffContext, staffEmail, password, outDir, 'staff')
  for (const shot of STAFF_SHOTS) {
    const file = await capture(page2, outDir, shot.name, shot.path)
    console.log('Wrote', file)
  }

  await staffContext.close()
  await browser.close()

  const latestDir = path.join(process.cwd(), 'artifacts', 'screen-capture', 'latest')
  await fs.rm(latestDir, { recursive: true, force: true })
  await fs.cp(outDir, latestDir, { recursive: true })

  console.log(`\nDone. This run: ${outDir}`)
  console.log(`Mirror (always newest): ${latestDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
