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
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  RESPONSIVE_QA_REQUIRED_CSS_VARIABLES,
  buildResponsiveQaAuthInstructions,
  buildResponsiveQaCaptureConfig,
  buildResponsiveQaDisposableAuthPlan,
  isResponsiveQaBlockedAuthenticatedUrl,
  isResponsiveQaNextStaticAssetUrl,
  shouldFailResponsiveQaRun,
  summarizeResponsiveQaAuthError,
  summarizeResponsiveQaPageValidation,
} from './lib/responsive-qa-capture-core.mjs'

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

function compactUrl(value) {
  try {
    const url = new URL(String(value))
    return `${url.pathname}${url.search}`
  } catch {
    return String(value)
  }
}

function createStaticAssetFailureTracker(page) {
  const failures = []
  const seen = new Set()

  function record(failure) {
    if (!isResponsiveQaNextStaticAssetUrl(failure.url)) return

    const key = [
      failure.kind,
      failure.url,
      failure.status ?? '',
      failure.errorText ?? '',
      failure.resourceType ?? '',
    ].join('|')
    if (seen.has(key)) return

    seen.add(key)
    failures.push(failure)
  }

  function onRequestFailed(request) {
    const failure = request.failure()
    record({
      kind: 'requestfailed',
      url: compactUrl(request.url()),
      method: request.method(),
      resourceType: request.resourceType(),
      errorText: failure?.errorText ?? 'request failed',
    })
  }

  function onResponse(response) {
    if (response.status() < 400) return

    record({
      kind: 'response',
      url: compactUrl(response.url()),
      method: response.request().method(),
      resourceType: response.request().resourceType(),
      status: response.status(),
      statusText: response.statusText(),
    })
  }

  page.on('requestfailed', onRequestFailed)
  page.on('response', onResponse)

  return {
    failures,
    dispose() {
      page.off('requestfailed', onRequestFailed)
      page.off('response', onResponse)
    },
  }
}

async function probeAppliedCss(page) {
  try {
    return await page.evaluate((requiredVariables) => {
      const rootStyle = window.getComputedStyle(document.documentElement)
      const bodyStyle = window.getComputedStyle(document.body)
      const presentVariables = requiredVariables.filter(
        (variable) => rootStyle.getPropertyValue(variable).trim().length > 0
      )

      const linkedNextStylesheets = [...document.querySelectorAll('link[rel~="stylesheet"]')]
        .map((link) => link.href)
        .filter((href) => {
          try {
            return new URL(href, document.baseURI).pathname.startsWith('/_next/static/')
          } catch {
            return false
          }
        })
        .map((href) => {
          const url = new URL(href, document.baseURI)
          return `${url.pathname}${url.search}`
        })
        .slice(0, 20)

      const loadedNextStylesheetCount = [...document.styleSheets].filter((sheet) => {
        if (!sheet.href) return false
        try {
          return new URL(sheet.href, document.baseURI).pathname.startsWith('/_next/static/')
        } catch {
          return false
        }
      }).length

      return {
        hasRequiredCssVariables: presentVariables.length === requiredVariables.length,
        presentVariables,
        linkedNextStylesheets,
        loadedNextStylesheetCount,
        styleTagCount: document.querySelectorAll('style').length,
        bodyBackgroundColor: bodyStyle.backgroundColor,
        bodyColor: bodyStyle.color,
      }
    }, RESPONSIVE_QA_REQUIRED_CSS_VARIABLES)
  } catch (error) {
    return {
      hasRequiredCssVariables: false,
      presentVariables: [],
      linkedNextStylesheets: [],
      loadedNextStylesheetCount: 0,
      styleTagCount: 0,
      evaluationError: error instanceof Error ? error.message : String(error),
    }
  }
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

async function listAllAuthUsers(adminClient) {
  const users = []
  let page = 1

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error

    const batch = data?.users ?? []
    users.push(...batch)
    if (batch.length < 200) break
    page += 1
  }

  return users
}

async function ensureDisposableAuthUser(adminClient, usersByEmail, { email, password, metadata }) {
  const key = String(email).trim().toLowerCase()
  const existing = usersByEmail.get(key)
  if (existing?.id) {
    const { error } = await adminClient.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    })
    if (error) throw error
    return existing.id
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: key,
    password,
    email_confirm: true,
    user_metadata: metadata,
  })
  if (error) throw error

  return data.user.id
}

async function provisionDisposableResponsiveQaAuth() {
  buildResponsiveQaDisposableAuthPlan({
    managerEmail: config.manager.email,
    therapistEmail: config.therapist.email,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Disposable responsive QA provisioning requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const authUsers = await listAllAuthUsers(adminClient)
  const usersByEmail = new Map(
    authUsers.map((user) => [
      String(user.email ?? '')
        .trim()
        .toLowerCase(),
      user,
    ])
  )

  const managerUserId = await ensureDisposableAuthUser(adminClient, usersByEmail, {
    email: config.manager.email,
    password: config.manager.password,
    metadata: {
      full_name: 'Responsive QA Manager',
      role: 'manager',
      shift_type: 'day',
    },
  })
  const therapistUserId = await ensureDisposableAuthUser(adminClient, usersByEmail, {
    email: config.therapist.email,
    password: config.therapist.password,
    metadata: {
      full_name: 'Responsive QA Therapist',
      role: 'therapist',
      shift_type: 'day',
    },
  })

  const plan = buildResponsiveQaDisposableAuthPlan({
    managerEmail: config.manager.email,
    therapistEmail: config.therapist.email,
    managerUserId,
    therapistUserId,
  })

  const { error: siteError } = await adminClient.from('sites').upsert(plan.site, {
    onConflict: 'id',
  })
  if (siteError) throw siteError

  const { error: profileError } = await adminClient.from('profiles').upsert(plan.profiles, {
    onConflict: 'id',
  })
  if (profileError) throw profileError

  const { error: patternError } = await adminClient
    .from('work_patterns')
    .upsert(plan.workPatterns, {
      onConflict: 'therapist_id',
    })
  if (patternError) throw patternError

  console.log('Provisioned disposable responsive QA auth profiles.')
  console.log(`Site: ${plan.site.id}`)
  console.log(`Manager: ${config.manager.email}`)
  console.log(`Therapist: ${config.therapist.email}`)
}

async function cleanupDisposableResponsiveQaAuth() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Disposable responsive QA cleanup requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  const plan = buildResponsiveQaDisposableAuthPlan({
    managerEmail: config.manager.email,
    therapistEmail: config.therapist.email,
  })

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const authUsers = await listAllAuthUsers(adminClient)
  const disposableEmails = new Set(plan.profiles.map((profile) => profile.email))
  const disposableUsers = authUsers.filter((user) => {
    const email = String(user.email ?? '')
      .trim()
      .toLowerCase()
    return disposableEmails.has(email)
  })
  const userIds = disposableUsers.map((user) => user.id).filter(Boolean)

  if (userIds.length > 0) {
    const { error: patternError } = await adminClient
      .from('work_patterns')
      .delete()
      .in('therapist_id', userIds)
    if (patternError) throw patternError

    const { error: profileError } = await adminClient.from('profiles').delete().in('id', userIds)
    if (profileError) throw profileError
  }

  for (const user of disposableUsers) {
    const { error } = await adminClient.auth.admin.deleteUser(user.id)
    if (error) throw error
  }

  console.log('Cleaned up disposable responsive QA auth profiles.')
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

    if (isResponsiveQaBlockedAuthenticatedUrl(page.url())) {
      const snap = path.join(outDir, `_session-failed-${label}.png`)
      await page.screenshot({ path: snap, fullPage: true }).catch(() => {})
      throw new Error(
        `Authenticated session did not reach the app dashboard; landed on ${page.url()}. See ${snap}.`
      )
    }

    return { context, page }
  } catch (error) {
    await context.close().catch(() => {})
    throw error
  }
}

async function captureRoute(page, outDir, route) {
  const url = `${config.baseURL}${cacheBustRelPath(route.path)}`
  const staticAssetTracker = createStaticAssetFailureTracker(page)
  let validation

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
    await page.waitForTimeout(700)

    validation = summarizeResponsiveQaPageValidation({
      staticAssetFailures: staticAssetTracker.failures,
      cssProbe: await probeAppliedCss(page),
    })
  } finally {
    staticAssetTracker.dispose()
  }

  const file = path.join(outDir, `${sanitizeFilename(route.name)}.png`)
  const viewportFile = path.join(outDir, `${sanitizeFilename(route.name)}-viewport.png`)
  await page.screenshot({ path: viewportFile, fullPage: false })
  await page.screenshot({ path: file, fullPage: true })
  return { file, viewportFile, finalUrl: page.url(), validation }
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

  for (const route of routes) {
    let session
    try {
      session = await createAuthenticatedPage(
        browser,
        viewport,
        account,
        viewportOutDir,
        `${persona}-${route.name}`
      )
    } catch (error) {
      const reason = summarizeResponsiveQaAuthError(error, config)
      summary.skipped.push({
        viewport: viewport.name,
        persona,
        name: route.name,
        path: route.path,
        reason,
      })
      console.warn(`Skipped ${viewport.name}/${persona}/${route.name}: ${reason}`)
      if (config.requiresAuthenticatedCoverage) {
        summary.authFailures += 1
      }
      continue
    }

    try {
      await captureOne(session.page, viewport.name, route, viewportOutDir, summary)
    } finally {
      await session.context.close()
    }
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
      viewportFile: captured.viewportFile,
    })

    if (route.persona !== 'public' && isResponsiveQaBlockedAuthenticatedUrl(captured.finalUrl)) {
      summary.authFailures += 1
      summary.errors.push({
        type: 'authenticated-route-blocked',
        viewport: viewportName,
        persona: route.persona,
        name: route.name,
        path: route.path,
        finalUrl: captured.finalUrl,
        file: captured.file,
        error: `Authenticated route landed on ${compactUrl(captured.finalUrl)}.`,
      })
      console.error(
        `Invalid ${viewportName}/${route.persona}/${route.name}: authenticated route landed on ${compactUrl(captured.finalUrl)}`
      )
    }

    if (captured.validation && !captured.validation.ok) {
      for (const validationError of captured.validation.errors) {
        summary.errors.push({
          type: validationError.type,
          viewport: viewportName,
          persona: route.persona,
          name: route.name,
          path: route.path,
          finalUrl: captured.finalUrl,
          file: captured.file,
          error: validationError.message,
          details: validationError,
        })
        console.error(
          `Invalid ${viewportName}/${route.persona}/${route.name}: ${validationError.message}`
        )
      }
    }
    for (const validationWarning of captured.validation?.warnings ?? []) {
      summary.warnings.push({
        type: validationWarning.type,
        viewport: viewportName,
        persona: route.persona,
        name: route.name,
        path: route.path,
        finalUrl: captured.finalUrl,
        file: captured.file,
        warning: validationWarning.message,
        details: validationWarning,
      })
      console.warn(
        `Warning ${viewportName}/${route.persona}/${route.name}: ${validationWarning.message}`
      )
    }
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
    requiresAuthenticatedCoverage: config.requiresAuthenticatedCoverage,
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
    warnings: [],
    authFailures: 0,
  }

  console.log(`Responsive QA capture (${config.effectiveMode} mode)`)
  console.log(`Base URL: ${config.baseURL}`)
  console.log(`Output: ${outDir}`)
  if (config.reducedMode) {
    console.log('Reduced mode: capturing public pages only because authenticated QA is disabled.')
  }
  if (config.requiresAuthenticatedCoverage) {
    console.log('Authenticated coverage requested.')
    console.log(`Manager account: ${config.manager.email}`)
    console.log(`Therapist account: ${config.therapist.email}`)
    console.log('Safe disposable auth path:')
    for (const line of buildResponsiveQaAuthInstructions(config)) {
      console.log(`- ${line}`)
    }
  }
  const shouldCleanupDisposableAuth = config.provisionAuth
  let browser = null
  try {
    if (config.provisionAuth) {
      await provisionDisposableResponsiveQaAuth()
    }

    browser = await chromium.launch({ headless: !config.headed })
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
    if (browser) {
      await browser.close()
    }
    if (shouldCleanupDisposableAuth) {
      try {
        await cleanupDisposableResponsiveQaAuth()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        summary.errors.push({
          type: 'disposable-auth-cleanup-failed',
          error: message,
        })
        console.error(`Disposable responsive QA cleanup failed: ${message}`)
      }
    }
  }

  await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8')
  await fs.rm(latestDir, { recursive: true, force: true })
  await fs.cp(outDir, latestDir, { recursive: true })

  console.log(`\nDone. This run: ${outDir}`)
  console.log(`Mirror (always newest): ${latestDir}`)
  console.log(
    `Summary: ${summary.shots.length} screenshots, ${summary.errors.length} errors, ${summary.warnings.length} warnings, ${summary.skipped.length} skipped.`
  )

  if (shouldFailResponsiveQaRun(summary)) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
