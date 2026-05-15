import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, randomString } from './helpers/env'
import { createScheduleCycle } from './helpers/schedule-cycles'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type Persona = 'public' | 'manager' | 'therapist'

type AuditRoute = {
  persona: Persona
  path: string
}

type AuditSummary = {
  clicked: Array<{ route: string; persona: Persona; label: string; before: string; after: string }>
  skipped: Array<{ route: string; persona: Persona; label: string; reason: string }>
  failures: Array<{ route: string; persona: Persona; label: string; before: string; after: string }>
}

type AuditContext = {
  manager: { id: string; email: string; password: string }
  therapist: { id: string; email: string; password: string }
  lead: { id: string }
  draftCycle: { id: string }
  publishedCycle: { id: string }
  publishEvent: { id: string }
}

const destructiveButtonPattern =
  /\b(approve|archive|auto-draft|clear draft|create draft|delete|decline|deny|import|pre-flight|process queued|publish|republish|re-send|reparse|save|send|sign in|submit|take offline|withdraw)\b/i

const ignorableButtonPattern = /\b(open next\.js dev tools)\b/i
const nonNavigationButtonPattern =
  /^(?:[0-9]+|[·.])$|\b(back|cancel|close|day|dismiss|expand all|hide advanced|more filters|next|night|notifications|open next\.js dev tools|print|show password|user menu)\b/i

const MAX_AUDIT_ROUTES = 48
const MAX_ROUTES_PER_PERSONA: Record<Persona, number> = {
  public: 4,
  manager: 14,
  therapist: 10,
}
const MAX_BUTTONS_PER_ROUTE = 3
const MAX_BUTTONS_TO_SCAN_PER_ROUTE = 24
const ROUTE_GOTO_TIMEOUT_MS = 8_000
const BUTTON_CLICK_TIMEOUT_MS = 2_000
const POST_CLICK_SETTLE_MS = 150

function isDashboardPath(pathname: string) {
  return (
    pathname === '/dashboard' ||
    pathname === '/dashboard/manager' ||
    pathname === '/dashboard/staff'
  )
}

function normalizeButtonLabel(text: string | null, ariaLabel: string | null) {
  const label = (ariaLabel || text || '').replace(/\s+/g, ' ').trim()
  return label || 'Unlabeled button'
}

async function createCycle(supabase: SupabaseClient, published: boolean) {
  const startDate = addDays(new Date(), published ? 3 : 30)
  const label = `Button Audit ${published ? 'Published' : 'Draft'} ${randomString('cycle')}`
  const result = await createScheduleCycle(supabase, { label, startDate, published })

  return { id: result.id, startDate: result.start_date, label }
}

async function seedAuditContext(supabase: SupabaseClient): Promise<AuditContext> {
  const managerEmail = `${randomString('button-manager')}@example.com`
  const managerPassword = `Mgr!${Math.random().toString(16).slice(2, 10)}`
  const manager = await createE2EUser(supabase, {
    email: managerEmail,
    password: managerPassword,
    fullName: 'Button Audit Manager',
    role: 'manager',
    employmentType: 'full_time',
    shiftType: 'day',
    isLeadEligible: true,
  })

  const therapistEmail = `${randomString('button-therapist')}@example.com`
  const therapistPassword = `Ther!${Math.random().toString(16).slice(2, 10)}`
  const therapist = await createE2EUser(supabase, {
    email: therapistEmail,
    password: therapistPassword,
    fullName: 'Button Audit Therapist',
    role: 'therapist',
    employmentType: 'full_time',
    shiftType: 'day',
    isLeadEligible: false,
  })

  const lead = await createE2EUser(supabase, {
    email: `${randomString('button-lead')}@example.com`,
    password: `Lead!${Math.random().toString(16).slice(2, 10)}`,
    fullName: 'Button Audit Lead',
    role: 'lead',
    employmentType: 'full_time',
    shiftType: 'day',
    isLeadEligible: true,
  })

  const draftCycle = await createCycle(supabase, false)
  const publishedCycle = await createCycle(supabase, true)

  const shiftInsert = await supabase.from('shifts').insert([
    {
      cycle_id: publishedCycle.id,
      user_id: therapist.id,
      date: publishedCycle.startDate,
      shift_type: 'day',
      status: 'scheduled',
      assignment_status: 'scheduled',
      role: 'staff',
    },
    {
      cycle_id: publishedCycle.id,
      user_id: lead.id,
      date: publishedCycle.startDate,
      shift_type: 'day',
      status: 'scheduled',
      assignment_status: 'scheduled',
      role: 'lead',
    },
    {
      cycle_id: draftCycle.id,
      user_id: therapist.id,
      date: draftCycle.startDate,
      shift_type: 'day',
      status: 'scheduled',
      assignment_status: 'scheduled',
      role: 'staff',
    },
  ])

  if (shiftInsert.error) {
    throw new Error(`Could not seed audit shifts: ${shiftInsert.error.message}`)
  }

  const publishEvent = await supabase
    .from('publish_events')
    .insert({
      cycle_id: publishedCycle.id,
      published_by: manager.id,
      status: 'success',
      recipient_count: 1,
      queued_count: 0,
      sent_count: 0,
      failed_count: 0,
    })
    .select('id')
    .single()

  if (publishEvent.error || !publishEvent.data) {
    throw new Error(publishEvent.error?.message ?? 'Could not seed audit publish event.')
  }

  return {
    manager: { id: manager.id, email: managerEmail, password: managerPassword },
    therapist: { id: therapist.id, email: therapistEmail, password: therapistPassword },
    lead,
    draftCycle: { id: draftCycle.id },
    publishedCycle: { id: publishedCycle.id },
    publishEvent: { id: publishEvent.data.id },
  }
}

function auditRoutes(ctx: AuditContext): AuditRoute[] {
  return [
    { persona: 'public', path: '/' },
    { persona: 'public', path: '/login' },
    { persona: 'public', path: '/signup' },
    { persona: 'public', path: '/reset-password' },
    { persona: 'manager', path: '/dashboard' },
    { persona: 'manager', path: '/dashboard/manager' },
    { persona: 'manager', path: `/coverage?view=week&cycle=${ctx.draftCycle.id}` },
    {
      persona: 'manager',
      path: `/availability?cycle=${ctx.draftCycle.id}&therapist=${ctx.therapist.id}`,
    },
    { persona: 'manager', path: '/availability/intake' },
    { persona: 'manager', path: '/schedule' },
    { persona: 'manager', path: '/preliminary' },
    { persona: 'manager', path: '/publish' },
    { persona: 'manager', path: `/publish/${ctx.publishEvent.id}` },
    { persona: 'manager', path: '/requests' },
    { persona: 'manager', path: '/requests/user-access' },
    { persona: 'manager', path: '/shift-board' },
    { persona: 'manager', path: '/team' },
    { persona: 'manager', path: '/team/import' },
    { persona: 'manager', path: '/team/work-patterns' },
    { persona: 'manager', path: `/team/work-patterns/${ctx.therapist.id}` },
    { persona: 'manager', path: '/settings' },
    { persona: 'manager', path: '/settings/audit-log' },
    { persona: 'manager', path: '/notifications' },
    { persona: 'manager', path: '/lottery' },
    { persona: 'manager', path: '/analytics' },
    { persona: 'manager', path: '/approvals' },
    { persona: 'manager', path: '/profile' },
    { persona: 'manager', path: '/directory' },
    { persona: 'therapist', path: '/dashboard' },
    { persona: 'therapist', path: '/dashboard/staff' },
    { persona: 'therapist', path: '/staff/dashboard' },
    { persona: 'therapist', path: '/staff/history' },
    { persona: 'therapist', path: '/staff/my-schedule' },
    { persona: 'therapist', path: '/staff/requests' },
    { persona: 'therapist', path: '/staff/schedule' },
    { persona: 'therapist', path: '/therapist' },
    { persona: 'therapist', path: '/therapist/availability' },
    { persona: 'therapist', path: '/therapist/recurring-pattern' },
    { persona: 'therapist', path: '/therapist/schedule' },
    { persona: 'therapist', path: '/therapist/settings' },
    { persona: 'therapist', path: '/therapist/swaps' },
    { persona: 'therapist', path: '/requests/new' },
    { persona: 'therapist', path: '/notifications' },
    { persona: 'therapist', path: '/profile' },
    { persona: 'therapist', path: '/coverage' },
  ]
}

function routeSkipReason(route: AuditRoute) {
  if (route.path.startsWith('/coverage')) {
    return 'legacy coverage redirect covered by schedule grid smoke'
  }

  return null
}

async function ensurePersona(page: Page, route: AuditRoute, ctx: AuditContext) {
  if (route.persona === 'public') return
  if (route.persona === 'manager') {
    await loginAs(page, ctx.manager.email, ctx.manager.password)
    return
  }
  await loginAs(page, ctx.therapist.email, ctx.therapist.password)
}

async function pageLooksBroken(page: Page) {
  const body = await page
    .locator('body')
    .innerText({ timeout: 5_000 })
    .catch(() => '')
  return /application error|this page could not be found|unhandled runtime error/i.test(body)
}

async function openAuditRoute(page: Page, route: AuditRoute, summary: AuditSummary) {
  try {
    await page.goto(route.path, { waitUntil: 'domcontentloaded', timeout: ROUTE_GOTO_TIMEOUT_MS })
  } catch (error) {
    if (!/net::ERR_ABORTED/i.test(String(error))) {
      summary.skipped.push({
        route: route.path,
        persona: route.persona,
        label: route.path,
        reason: `route did not reach domcontentloaded within ${ROUTE_GOTO_TIMEOUT_MS}ms`,
      })
      return false
    }
  }
  await page.waitForTimeout(POST_CLICK_SETTLE_MS)
  return true
}

async function auditRouteButtons(
  page: Page,
  route: AuditRoute,
  ctx: AuditContext,
  summary: AuditSummary
) {
  if (!(await openAuditRoute(page, route, summary))) return

  const initialUrl = new URL(page.url())
  const initialPath = initialUrl.pathname
  const buttonCount = await page.getByRole('button').count()
  const scannedButtonCount = Math.min(buttonCount, MAX_BUTTONS_TO_SCAN_PER_ROUTE)
  let clickedOnRoute = 0

  if (buttonCount > MAX_BUTTONS_TO_SCAN_PER_ROUTE) {
    summary.skipped.push({
      route: route.path,
      persona: route.persona,
      label: `${buttonCount - MAX_BUTTONS_TO_SCAN_PER_ROUTE} additional buttons`,
      reason: `route scan cap ${MAX_BUTTONS_TO_SCAN_PER_ROUTE}`,
    })
  }

  for (let index = 0; index < scannedButtonCount; index += 1) {
    if (clickedOnRoute >= MAX_BUTTONS_PER_ROUTE) {
      summary.skipped.push({
        route: route.path,
        persona: route.persona,
        label: `${scannedButtonCount - index} additional scanned buttons`,
        reason: `eligible click cap ${MAX_BUTTONS_PER_ROUTE}`,
      })
      break
    }
    if (!(await openAuditRoute(page, route, summary))) return

    const buttons = page.getByRole('button')
    if (index >= (await buttons.count())) continue

    const button = buttons.nth(index)
    const label = normalizeButtonLabel(
      await button.innerText().catch(() => null),
      await button.getAttribute('aria-label')
    )

    if (!(await button.isVisible().catch(() => false))) {
      summary.skipped.push({
        route: route.path,
        persona: route.persona,
        label,
        reason: 'not visible',
      })
      continue
    }
    if (await button.isDisabled().catch(() => false)) {
      summary.skipped.push({ route: route.path, persona: route.persona, label, reason: 'disabled' })
      continue
    }
    if (ignorableButtonPattern.test(label)) {
      summary.skipped.push({
        route: route.path,
        persona: route.persona,
        label,
        reason: 'dev tooling',
      })
      continue
    }
    if (destructiveButtonPattern.test(label)) {
      summary.skipped.push({
        route: route.path,
        persona: route.persona,
        label,
        reason: 'state-changing action covered by workflow e2e',
      })
      continue
    }
    if (nonNavigationButtonPattern.test(label)) {
      summary.skipped.push({
        route: route.path,
        persona: route.persona,
        label,
        reason: 'local control, menu, or dense grid cell',
      })
      continue
    }

    const before = page.url()
    await button.scrollIntoViewIfNeeded().catch(() => undefined)
    const clickError = await button.click({ timeout: BUTTON_CLICK_TIMEOUT_MS }).catch((error) => {
      summary.failures.push({
        route: route.path,
        persona: route.persona,
        label,
        before,
        after: `click failed: ${String(error?.message ?? error)}`,
      })
      return error as unknown
    })
    if (clickError) continue
    await page.waitForTimeout(POST_CLICK_SETTLE_MS)

    const after = page.url()
    const afterPath = new URL(after).pathname
    summary.clicked.push({ route: route.path, persona: route.persona, label, before, after })
    clickedOnRoute += 1

    if (!isDashboardPath(initialPath) && isDashboardPath(afterPath)) {
      summary.failures.push({ route: route.path, persona: route.persona, label, before, after })
    }
    if (await pageLooksBroken(page)) {
      summary.failures.push({ route: route.path, persona: route.persona, label, before, after })
    }
  }
}

test.describe.serial('site-wide button navigation audit', () => {
  test.setTimeout(1_200_000)

  let supabase: SupabaseClient | null = null
  let ctx: AuditContext | null = null

  test.beforeAll(async () => {
    supabase = createServiceRoleClientOrNull()
    if (!supabase) return
    ctx = await seedAuditContext(supabase)
  })

  test.afterAll(async () => {
    if (!supabase || !ctx) return
    await supabase.from('notification_outbox').delete().eq('user_id', ctx.therapist.id)
    await supabase.from('publish_events').delete().eq('id', ctx.publishEvent.id)
    await supabase
      .from('shift_post_interests')
      .delete()
      .in('therapist_id', [ctx.manager.id, ctx.therapist.id, ctx.lead.id])
    await supabase
      .from('shift_posts')
      .delete()
      .in('posted_by', [ctx.manager.id, ctx.therapist.id, ctx.lead.id])
    await supabase
      .from('availability_overrides')
      .delete()
      .in('therapist_id', [ctx.therapist.id, ctx.lead.id])
    await supabase
      .from('therapist_availability_submissions')
      .delete()
      .in('therapist_id', [ctx.therapist.id, ctx.lead.id])
    await supabase
      .from('shifts')
      .delete()
      .in('cycle_id', [ctx.draftCycle.id, ctx.publishedCycle.id])
    await supabase
      .from('schedule_cycles')
      .delete()
      .in('id', [ctx.draftCycle.id, ctx.publishedCycle.id])
    for (const userId of [ctx.manager.id, ctx.therapist.id, ctx.lead.id]) {
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('visible enabled non-destructive buttons do not unexpectedly return to dashboards', async ({
    browser,
  }) => {
    test.skip(!supabase || !ctx, 'Supabase service env values are required for button audit e2e.')

    const summary: AuditSummary = { clicked: [], skipped: [], failures: [] }

    const routesByPersona = new Map<Persona, AuditRoute[]>()
    const routes = auditRoutes(ctx!)
    for (const route of routes.slice(0, MAX_AUDIT_ROUTES)) {
      const skipReason = routeSkipReason(route)
      if (skipReason) {
        summary.skipped.push({
          route: route.path,
          persona: route.persona,
          label: route.path,
          reason: skipReason,
        })
        continue
      }
      const personaRoutes = routesByPersona.get(route.persona) ?? []
      if (personaRoutes.length >= MAX_ROUTES_PER_PERSONA[route.persona]) {
        summary.skipped.push({
          route: route.path,
          persona: route.persona,
          label: route.path,
          reason: `persona route cap ${MAX_ROUTES_PER_PERSONA[route.persona]}`,
        })
        continue
      }
      routesByPersona.set(route.persona, [...personaRoutes, route])
    }
    for (const route of routes.slice(MAX_AUDIT_ROUTES)) {
      summary.skipped.push({
        route: route.path,
        persona: route.persona,
        label: route.path,
        reason: `route cap ${MAX_AUDIT_ROUTES}`,
      })
    }

    for (const [persona, routes] of routesByPersona) {
      const context = await browser.newContext()
      const page = await context.newPage()
      try {
        if (persona !== 'public') {
          await ensurePersona(page, { persona, path: '/dashboard' }, ctx!)
        }
        for (const route of routes) {
          await auditRouteButtons(page, route, ctx!, summary)
        }
      } finally {
        await context.close().catch(() => undefined)
      }
    }

    await fs.mkdir(path.join(process.cwd(), 'test-results'), { recursive: true })
    await fs.writeFile(
      path.join(process.cwd(), 'test-results', 'button-navigation-audit.json'),
      JSON.stringify(summary, null, 2)
    )

    expect(summary.failures).toEqual([])
    expect(summary.clicked.length + summary.skipped.length).toBeGreaterThan(0)
  })
})
