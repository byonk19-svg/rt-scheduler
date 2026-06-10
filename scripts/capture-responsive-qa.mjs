/**
 * Capture final demo/UAT responsive screenshots for public, manager, and therapist surfaces.
 *
 * Run after a local server is listening at PLAYWRIGHT_BASE_URL, for example:
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm run qa:responsive
 *
 * Output:
 *   artifacts/responsive-qa/<timestamp>/
 *   artifacts/responsive-qa/latest/
 */

import nextEnv from '@next/env'
import { createServerClient } from '@supabase/ssr'
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

import { buildResponsiveQaCaptureConfig } from './lib/responsive-qa-capture-core.mjs'

const { loadEnvConfig } = nextEnv

loadEnvConfig(process.cwd())

const config = buildResponsiveQaCaptureConfig({
  argv: process.argv.slice(2),
  env: process.env,
  cwd: process.cwd(),
})

function cacheBustRelPath(relPath) {
  const ts = Date.now()
  const sep = relPath.includes('?') ? '&' : '?'
  return `${relPath}${sep}_qa=${ts}`
}

function sanitizeFilename(name) {
  return name.replace(/[^\w-]+/g, '_').slice(0, 120)
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
  if (error) {
    throw new Error(error.message)
  }

  return jar.entries()
}

function toPlaywrightCookies(jarEntries) {
  const { hostname } = new URL(config.baseURL)
  const host = hostname === 'localhost' || hostname === '127.0.0.1' ? hostname : hostname

  return jarEntries.map(([name, row]) => {
    const cookie = {
      name,
      value: row.value,
      domain: host,
      path: typeof row.options.path === 'string' ? row.options.path : '/',
      httpOnly: Boolean(row.options.httpOnly),
      secure: Boolean(row.options.secure),
    }

    const sameSite = row.options.sameSite
    if (sameSite === 'none' || sameSite === 'None') cookie.sameSite = 'None'
    else if (sameSite === 'strict' || sameSite === 'Strict') cookie.sameSite = 'Strict'
    else cookie.sameSite = 'Lax'

    if (typeof row.options.maxAge === 'number' && Number.isFinite(row.options.maxAge)) {
      cookie.expires = Math.round(Date.now() / 1000) + row.options.maxAge
    }

    return cookie
  })
}

async function createAuthenticatedPage(browser, viewport, account, outDir, label) {
  const context = await browser.newContext({
    ...viewport.options,
    serviceWorkers: 'block',
  })

  try {
    const cookieEntries = await signInWithPassword(account.email, account.password)
    await context.addCookies(toPlaywrightCookies(cookieEntries))

    const page = await context.newPage()
    await page.goto(`${config.baseURL}${cacheBustRelPath('/dashboard')}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})

    if (/\/login(?:[/?#]|$)/i.test(page.url())) {
      const snap = path.join(outDir, `_session-failed-${label}.png`)
      await page.screenshot({ path: snap, fullPage: true }).catch(() => {})
      throw new Error(`Authenticated session redirected to login. See ${snap}.`)
    }

    return { context, page }
  } catch (error) {
    await context.close().catch(() => {})
    throw error
  }
}

async function captureRoute(page, outDir, route) {
  const url = `${config.baseURL}${cacheBustRelPath(route.path)}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
  await page.waitForTimeout(700)

  const file = path.join(outDir, `${sanitizeFilename(route.name)}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return { file, finalUrl: page.url() }
}

function summarizeAuthError(error) {
  const message = error instanceof Error ? error.message : String(error)
  if (/invalid login credentials/i.test(message)) {
    return 'Seeded credentials were rejected. Run npm run seed:functional or set SHOT_* credentials.'
  }
  if (/NEXT_PUBLIC_SUPABASE/i.test(message)) {
    return 'Supabase auth env vars are missing.'
  }
  return message
}

async function capturePublic(browser, viewport, viewportOutDir, summary) {
  const context = await browser.newContext({
    ...viewport.options,
    serviceWorkers: 'block',
  })
  const page = await context.newPage()

  try {
    for (const route of config.routes.filter((item) => item.persona === 'public')) {
      await captureOne(page, viewport.name, route, viewportOutDir, summary)
    }
  } finally {
    await context.close()
  }
}

async function captureAuthenticated(browser, viewport, persona, viewportOutDir, summary) {
  const account = persona === 'manager' ? config.manager : config.therapist
  const routes = config.routes.filter((route) => route.persona === persona)
  if (routes.length === 0) return

  let session
  try {
    session = await createAuthenticatedPage(browser, viewport, account, viewportOutDir, persona)
  } catch (error) {
    const reason = summarizeAuthError(error)
    for (const route of routes) {
      summary.skipped.push({
        viewport: viewport.name,
        persona,
        name: route.name,
        path: route.path,
        reason,
      })
    }
    console.warn(`Skipped ${viewport.name}/${persona}: ${reason}`)
    if (config.strictAuth) {
      summary.authFailures += 1
    }
    return
  }

  try {
    for (const route of routes) {
      await captureOne(session.page, viewport.name, route, viewportOutDir, summary)
    }
  } finally {
    await session.context.close()
  }
}

async function captureOne(page, viewportName, route, outDir, summary) {
  try {
    const captured = await captureRoute(page, outDir, route)
    summary.shots.push({
      viewport: viewportName,
      persona: route.persona,
      name: route.name,
      path: route.path,
      finalUrl: captured.finalUrl,
      file: captured.file,
    })
    console.log(`Wrote ${captured.file}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    summary.errors.push({
      viewport: viewportName,
      persona: route.persona,
      name: route.name,
      path: route.path,
      error: message,
    })
    console.error(`Failed ${viewportName}/${route.persona}/${route.name}: ${message}`)
  }
}

async function main() {
  const outDir = path.resolve(config.cwd, config.outputDir)
  const latestDir = path.resolve(config.cwd, config.latestDir)
  await fs.mkdir(outDir, { recursive: true })

  const summary = {
    baseURL: config.baseURL,
    generatedAt: new Date().toISOString(),
    output: outDir,
    mode: config.effectiveMode,
    requestedMode: config.requestedMode,
    reducedMode: config.reducedMode,
    viewports: config.viewports.map((viewport) => ({
      name: viewport.name,
      width: viewport.options.viewport.width,
      height: viewport.options.viewport.height,
    })),
    routes: config.routes.map(({ persona, name, path: routePath }) => ({
      persona,
      name,
      path: routePath,
    })),
    shots: [],
    skipped: [],
    errors: [],
    authFailures: 0,
  }

  console.log(`Responsive QA capture (${config.effectiveMode} mode)`)
  console.log(`Base URL: ${config.baseURL}`)
  console.log(`Output: ${outDir}`)
  if (config.reducedMode) {
    console.log('Reduced mode: capturing public pages only because authenticated QA is disabled.')
  }

  const browser = await chromium.launch({ headless: !config.headed })
  try {
    for (const viewport of config.viewports) {
      const viewportOutDir = path.join(outDir, viewport.name)
      await fs.mkdir(viewportOutDir, { recursive: true })
      console.log(
        `\n=== ${viewport.name} (${viewport.options.viewport.width}x${viewport.options.viewport.height}) ===`
      )

      if (config.personas.includes('public')) {
        await capturePublic(browser, viewport, viewportOutDir, summary)
      }
      if (config.personas.includes('manager')) {
        await captureAuthenticated(browser, viewport, 'manager', viewportOutDir, summary)
      }
      if (config.personas.includes('therapist')) {
        await captureAuthenticated(browser, viewport, 'therapist', viewportOutDir, summary)
      }
    }
  } finally {
    await browser.close()
  }

  await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8')
  await fs.rm(latestDir, { recursive: true, force: true })
  await fs.cp(outDir, latestDir, { recursive: true })

  console.log(`\nDone. This run: ${outDir}`)
  console.log(`Mirror (always newest): ${latestDir}`)
  console.log(
    `Summary: ${summary.shots.length} screenshots, ${summary.errors.length} errors, ${summary.skipped.length} skipped.`
  )

  if (summary.errors.length > 0 || (config.strictAuth && summary.authFailures > 0)) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
