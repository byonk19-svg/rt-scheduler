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
 *   SHOT_MANAGER_EMAIL    (default julie.d@teamwise.test)
 *   SHOT_STAFF_EMAIL      (default layne@teamwise.test)
 *   SHOT_PASSWORD         (default Teamwise123!)
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD — fallback if SHOT_* not set for manager
 */
import { createServerClient } from '@supabase/ssr'
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseURL = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')

const VIEWPORTS = [
  {
    name: 'desktop',
    options: {
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    },
  },
  {
    name: 'mobile',
    options: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  },
]

function csvFilter(name) {
  const raw = process.env[name]
  if (!raw) return null
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  )
}

const viewportFilter = csvFilter('SHOT_VIEWPORTS')
const personaFilter = csvFilter('SHOT_PERSONAS')

function selectedViewportList() {
  return viewportFilter
    ? VIEWPORTS.filter((viewport) => viewportFilter.has(viewport.name))
    : VIEWPORTS
}

function shouldRunPersona(persona) {
  return !personaFilter || personaFilter.has(persona)
}

function mergeByKey(existing, next, keyFor) {
  const merged = new Map()
  for (const item of [...existing, ...next]) {
    merged.set(keyFor(item), item)
  }
  return [...merged.values()]
}

async function mergeSummary(summaryPath, summary) {
  try {
    const existing = JSON.parse(await fs.readFile(summaryPath, 'utf8'))
    summary.shots = mergeByKey(existing.shots ?? [], summary.shots, (item) =>
      [item.viewport, item.persona, item.name, item.path].join('|')
    )
    summary.errors = mergeByKey(existing.errors ?? [], summary.errors, (item) =>
      [item.viewport, item.persona, item.name, item.path].join('|')
    )
    summary.skipped = mergeByKey(existing.skipped ?? [], summary.skipped, (item) =>
      [item.viewport, item.persona, item.name].join('|')
    )
  } catch {
    // No prior summary to merge.
  }
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
}

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
  process.env.SHOT_MANAGER_EMAIL ?? process.env.E2E_USER_EMAIL ?? 'julie.d@teamwise.test'
const staffEmail = process.env.SHOT_STAFF_EMAIL ?? 'layne@teamwise.test'
const password = process.env.SHOT_PASSWORD ?? process.env.E2E_USER_PASSWORD ?? 'Teamwise123!'

const PUBLIC_SHOTS = [
  { name: '01-public-home', path: '/' },
  { name: '02-public-login', path: '/login' },
  { name: '03-public-signup', path: '/signup' },
  { name: '04-public-reset-password', path: '/reset-password' },
  { name: '05-public-auth', path: '/auth' },
]

const MANAGER_SHOTS = [
  { name: '10-manager-dashboard', path: '/dashboard/manager' },
  { name: '11-manager-dashboard-canonical', path: '/dashboard' },
  { name: '12-manager-schedule', path: '/schedule' },
  {
    name: '13-manager-schedule-needs-attention',
    path: '/schedule?filter=needs_attention&focus=first',
  },
  { name: '14-manager-schedule-night', path: '/schedule?shift=night' },
  { name: '15-manager-analytics', path: '/analytics' },
  { name: '16-manager-availability', path: '/availability' },
  { name: '17-manager-availability-intake', path: '/availability/intake' },
  { name: '18-manager-lottery', path: '/lottery' },
  { name: '19-manager-shift-board', path: '/shift-board' },
  { name: '20-manager-team', path: '/team' },
  { name: '21-manager-team-work-patterns', path: '/team/work-patterns' },
  { name: '22-manager-team-import', path: '/team/import' },
  { name: '23-manager-directory', path: '/directory' },
  { name: '24-manager-approvals', path: '/approvals' },
  { name: '25-manager-preliminary', path: '/preliminary' },
  { name: '26-manager-publish-history', path: '/publish' },
  { name: '27-manager-requests', path: '/requests' },
  { name: '28-manager-user-access-requests', path: '/requests/user-access' },
  { name: '29-manager-notifications', path: '/notifications' },
  { name: '30-manager-settings', path: '/settings' },
  { name: '31-manager-audit-log', path: '/settings/audit-log' },
  { name: '32-manager-profile', path: '/profile' },
  { name: '33-manager-swaps-compat', path: '/swaps' },
]

const STAFF_SHOTS = [
  { name: '40-staff-dashboard', path: '/dashboard/staff' },
  { name: '41-staff-dashboard-canonical', path: '/dashboard' },
  { name: '42-staff-dashboard-alias', path: '/staff/dashboard' },
  { name: '43-staff-schedule-compat', path: '/therapist/schedule' },
  { name: '44-staff-my-shifts-alias', path: '/staff/my-schedule' },
  { name: '45-staff-schedule-alias', path: '/staff/schedule' },
  { name: '46-staff-coverage-compat', path: '/coverage?shift=day' },
  { name: '47-staff-schedule', path: '/schedule' },
  { name: '48-staff-preliminary', path: '/preliminary' },
  { name: '49-staff-recurring-pattern', path: '/therapist/recurring-pattern' },
  { name: '50-staff-future-availability', path: '/therapist/availability' },
  { name: '51-staff-shift-board', path: '/shift-board' },
  { name: '52-staff-swaps', path: '/therapist/swaps' },
  { name: '53-staff-requests-new', path: '/requests/new' },
  { name: '54-staff-requests-history', path: '/staff/history' },
  { name: '55-staff-requests-alias', path: '/staff/requests' },
  { name: '56-staff-notifications', path: '/notifications' },
  { name: '57-staff-settings', path: '/therapist/settings' },
  { name: '58-staff-profile', path: '/profile' },
  { name: '59-staff-onboarding', path: '/onboarding' },
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
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  // Client-heavy App Router pages can keep background requests open; do not block
  // the inventory on perfect network quiescence.
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
  await page.waitForTimeout(900)
  const file = path.join(outDir, `${sanitizeFilename(name)}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function tryFirstLinkCapture(page, outDir, name, sourcePath, hrefPattern) {
  try {
    await page.goto(`${baseURL}${cacheBustRelPath(sourcePath)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await page.waitForTimeout(800)
    const href = await page.evaluate((patternSource) => {
      const pattern = new RegExp(patternSource)
      const links = Array.from(document.querySelectorAll('a[href]'))
      return links
        .map((link) => link.getAttribute('href'))
        .find((href) => href && pattern.test(href))
    }, hrefPattern.source)
    if (!href) return null
    const detailPath = href.startsWith('/') ? href : `/${href}`
    await page.goto(`${baseURL}${cacheBustRelPath(detailPath)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
    await page.waitForTimeout(1200)
    const file = path.join(outDir, `${sanitizeFilename(name)}.png`)
    await page.screenshot({ path: file, fullPage: true })
    return file
  } catch {
    return null
  }
}

async function main() {
  assertLikelyLocalDev()

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = process.env.SHOT_OUTPUT_DIR
    ? path.resolve(process.cwd(), process.env.SHOT_OUTPUT_DIR)
    : path.join(process.cwd(), 'artifacts', 'screen-capture', stamp)
  await fs.mkdir(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const summary = {
    baseURL,
    generatedAt: new Date().toISOString(),
    output: outDir,
    viewports: selectedViewportList().map((viewport) => ({
      name: viewport.name,
      width: viewport.options.viewport.width,
      height: viewport.options.viewport.height,
    })),
    shots: [],
    skipped: [],
    errors: [],
  }

  async function captureSafe(page, viewportName, persona, viewportOutDir, shot) {
    try {
      const file = await capture(page, viewportOutDir, shot.name, shot.path)
      summary.shots.push({
        viewport: viewportName,
        persona,
        name: shot.name,
        path: shot.path,
        file,
      })
      console.log('Wrote', file)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      summary.errors.push({
        viewport: viewportName,
        persona,
        name: shot.name,
        path: shot.path,
        error: message,
      })
      console.error(`Failed ${viewportName}/${persona}/${shot.name} (${shot.path}): ${message}`)
    }
  }

  console.log(`Base URL: ${baseURL}`)
  console.log(`Output: ${outDir}`)
  console.log(
    'Using cache-busted navigations + blocked service workers so each shot reflects a fresh document load.\n'
  )

  for (const viewport of selectedViewportList()) {
    const viewportOutDir = path.join(outDir, viewport.name)
    await fs.mkdir(viewportOutDir, { recursive: true })
    const contextOpts = {
      ...viewport.options,
      serviceWorkers: 'block',
    }

    console.log(
      `\n=== ${viewport.name} (${contextOpts.viewport.width}x${contextOpts.viewport.height}) ===`
    )

    if (shouldRunPersona('public')) {
      const publicContext = await browser.newContext(contextOpts)
      const publicPage = await publicContext.newPage()

      for (const shot of PUBLIC_SHOTS) {
        await captureSafe(publicPage, viewport.name, 'public', viewportOutDir, shot)
      }

      await publicContext.close()
    }

    if (shouldRunPersona('manager')) {
      console.log('\n--- Manager session ---')
      const managerContext = await browser.newContext(contextOpts)
      const page = await attachSession(
        managerContext,
        managerEmail,
        password,
        viewportOutDir,
        'manager'
      )
      for (const shot of MANAGER_SHOTS) {
        await captureSafe(page, viewport.name, 'manager', viewportOutDir, shot)
      }
      const publishDetail = await tryFirstLinkCapture(
        page,
        viewportOutDir,
        '34-manager-publish-detail',
        '/publish',
        /^\/publish\/[^/?#]+/
      )
      if (publishDetail) {
        summary.shots.push({
          viewport: viewport.name,
          persona: 'manager',
          name: '34-manager-publish-detail',
          path: '/publish/[id]',
          file: publishDetail,
        })
        console.log('Wrote', publishDetail)
      } else {
        summary.skipped.push({
          viewport: viewport.name,
          persona: 'manager',
          name: '34-manager-publish-detail',
          reason: 'no row/link',
        })
        console.log('Skipped publish detail (no row/link)')
      }

      const workPatternDetail = await tryFirstLinkCapture(
        page,
        viewportOutDir,
        '35-manager-team-work-pattern-detail',
        '/team/work-patterns',
        /^\/team\/work-patterns\/[^/?#]+/
      )
      if (workPatternDetail) {
        summary.shots.push({
          viewport: viewport.name,
          persona: 'manager',
          name: '35-manager-team-work-pattern-detail',
          path: '/team/work-patterns/[therapistId]',
          file: workPatternDetail,
        })
        console.log('Wrote', workPatternDetail)
      } else {
        summary.skipped.push({
          viewport: viewport.name,
          persona: 'manager',
          name: '35-manager-team-work-pattern-detail',
          reason: 'no row/link',
        })
        console.log('Skipped work-pattern detail (no row/link)')
      }

      await managerContext.close()
    }

    if (shouldRunPersona('staff')) {
      const staffContext = await browser.newContext(contextOpts)

      console.log('\n--- Staff session ---')
      const page2 = await attachSession(staffContext, staffEmail, password, viewportOutDir, 'staff')
      for (const shot of STAFF_SHOTS) {
        await captureSafe(page2, viewport.name, 'staff', viewportOutDir, shot)
      }

      await staffContext.close()
    }
  }
  await browser.close()

  const summaryPath = path.join(outDir, 'summary.json')
  await mergeSummary(summaryPath, summary)

  const latestDir = path.join(process.cwd(), 'artifacts', 'screen-capture', 'latest')
  await fs.rm(latestDir, { recursive: true, force: true })
  await fs.cp(outDir, latestDir, { recursive: true })

  console.log(`\nDone. This run: ${outDir}`)
  console.log(`Mirror (always newest): ${latestDir}`)
  console.log(
    `Summary: ${summaryPath} (${summary.shots.length} screenshots, ${summary.errors.length} errors, ${summary.skipped.length} skipped)`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
