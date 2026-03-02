import { expect, test, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Shared helpers (mirrors directory-date-override.spec.ts)
// ---------------------------------------------------------------------------

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  therapist1: { id: string; fullName: string }
  therapist2: { id: string; fullName: string }
  // PRN day-shift therapist; pre-seeded with one night shift on targetDate so their
  // weekly count (1) equals their PRN limit (1) when the Day panel opens.
  therapist3: { id: string; fullName: string }
  cycle: { id: string }
  targetDate: string
  assignDate2: string // clean day (start + 15) where both therapists are available
}

const envCache = new Map<string, string>()

function getEnvFromFile(key: string): string | undefined {
  if (envCache.has(key)) return envCache.get(key)
  const envPath = path.resolve(process.cwd(), '.env.local')
  try {
    const raw = readFileSync(envPath, 'utf-8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex <= 0) continue
      const parsedKey = trimmed.slice(0, eqIndex).trim()
      let parsedValue = trimmed.slice(eqIndex + 1).trim()
      if (
        (parsedValue.startsWith('"') && parsedValue.endsWith('"')) ||
        (parsedValue.startsWith("'") && parsedValue.endsWith("'"))
      ) {
        parsedValue = parsedValue.slice(1, -1)
      }
      envCache.set(parsedKey, parsedValue)
    }
  } catch {
    return undefined
  }
  return envCache.get(key)
}

function getEnv(key: string): string | undefined {
  return process.env[key] ?? getEnvFromFile(key)
}

function formatDateKey(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function randomString(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

async function createUser(
  supabase: SupabaseClient,
  payload: {
    email: string
    password: string
    fullName: string
    role: 'manager' | 'therapist'
    employmentType: 'full_time' | 'prn'
    shiftType: 'day' | 'night'
    isLeadEligible?: boolean
  }
): Promise<{ id: string }> {
  const createResult = await supabase.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    user_metadata: { full_name: payload.fullName },
  })

  if (createResult.error || !createResult.data.user) {
    throw new Error(
      `Could not create test user ${payload.email}: ${createResult.error?.message ?? 'unknown error'}`
    )
  }

  const userId = createResult.data.user.id
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      full_name: payload.fullName,
      email: payload.email,
      role: payload.role,
      shift_type: payload.shiftType,
      employment_type: payload.employmentType,
      max_work_days_per_week: payload.employmentType === 'prn' ? 1 : 3,
      preferred_work_days: [],
      is_lead_eligible: payload.isLeadEligible ?? false,
      on_fmla: false,
      is_active: true,
      site_id: 'default',
    },
    { onConflict: 'id' }
  )

  if (profileError) {
    throw new Error(`Could not upsert profile for ${payload.email}: ${profileError.message}`)
  }

  return { id: userId }
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(/\/dashboard\//, { timeout: 30_000 })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe.serial('coverage calendar overlay interactions', () => {
  let ctx: TestContext | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const managerEmail = `${randomString('cov-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const manager = await createUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'E2E Cov Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const therapist1FullName = `E2E Cov Lead ${randomString('t1')}`
    const therapist1 = await createUser(supabase, {
      email: `${randomString('cov-t1')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapist1FullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const therapist2FullName = `E2E Cov Staff ${randomString('t2')}`
    const therapist2 = await createUser(supabase, {
      email: `${randomString('cov-t2')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapist2FullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    // PRN therapist with max 1 shift/week — used for workload-warning test.
    // Pre-seeded with a night shift on targetDate so their weekly count equals their limit.
    const therapist3FullName = `E2E Cov PRN ${randomString('t3')}`
    const therapist3 = await createUser(supabase, {
      email: `${randomString('cov-t3')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapist3FullName,
      role: 'therapist',
      employmentType: 'prn',
      shiftType: 'day',
      isLeadEligible: false,
    })

    createdUserIds.push(manager.id, therapist1.id, therapist2.id, therapist3.id)

    // Cycle: yesterday → yesterday + 41 days
    const start = new Date()
    start.setDate(start.getDate() - 1)
    const end = new Date(start)
    end.setDate(end.getDate() + 41)

    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: randomString('E2E Cov Cycle'),
        start_date: formatDateKey(start),
        end_date: formatDateKey(end),
        published: false,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(
        `Could not create test cycle: ${cycleInsert.error?.message ?? 'unknown error'}`
      )
    }

    createdCycleIds.push(cycleInsert.data.id)

    // Target date: start + 5 days (guaranteed within cycle)
    const targetDateObj = new Date(start)
    targetDateObj.setDate(targetDateObj.getDate() + 5)
    const targetDate = formatDateKey(targetDateObj)

    // Assign date 2: start + 15 days — clean day, no pre-seeded shifts, for lead-toggle test
    const assignDate2Obj = new Date(start)
    assignDate2Obj.setDate(assignDate2Obj.getDate() + 15)
    const assignDate2 = formatDateKey(assignDate2Obj)

    // Seed shifts on targetDate:
    //  - therapist1 as day-lead (accordion + lead tests)
    //  - therapist2 as day-staff (accordion + status + unassign tests)
    //  - therapist3 as night-staff (puts them at their PRN weekly limit for the workload-warning test
    //    without changing the Day-tab cell count, which must stay 2/2 for earlier tests)
    const shiftsInsert = await supabase.from('shifts').insert([
      {
        cycle_id: cycleInsert.data.id,
        user_id: therapist1.id,
        date: targetDate,
        shift_type: 'day',
        role: 'lead',
        status: 'scheduled',
      },
      {
        cycle_id: cycleInsert.data.id,
        user_id: therapist2.id,
        date: targetDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
      },
      {
        cycle_id: cycleInsert.data.id,
        user_id: therapist3.id,
        date: targetDate,
        shift_type: 'night',
        role: 'staff',
        status: 'scheduled',
      },
    ])

    if (shiftsInsert.error) {
      throw new Error(`Could not seed shifts: ${shiftsInsert.error.message}`)
    }

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      therapist1: { id: therapist1.id, fullName: therapist1FullName },
      therapist2: { id: therapist2.id, fullName: therapist2FullName },
      therapist3: { id: therapist3.id, fullName: therapist3FullName },
      cycle: { id: cycleInsert.data.id },
      targetDate,
      assignDate2,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return
    for (const cycleId of createdCycleIds) {
      await ctx.supabase.from('shifts').delete().eq('cycle_id', cycleId)
      await ctx.supabase.from('schedule_cycles').delete().eq('id', cycleId)
    }
    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
  })

  // Helper: the Close button is only in the DOM when the panel is open
  // (content renders as `{selectedDay && (...)}` so leaving DOM on close)
  function panelCloseBtn(page: Page) {
    return page.getByLabel('Close details panel')
  }

  // -------------------------------------------------------------------------
  // Test 1: Clicking a day cell opens the panel
  // -------------------------------------------------------------------------
  test('clicking a day cell opens the slide-over panel', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    // Wait for calendar grid to load
    await expect(page.locator('.grid-cols-7 button').first()).toBeVisible({ timeout: 15_000 })

    // Click the first day cell in the calendar
    await page.locator('.grid-cols-7 button').first().click()

    // Panel should open: Close button enters the DOM
    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })
  })

  // -------------------------------------------------------------------------
  // Test 2: × button closes the panel
  // -------------------------------------------------------------------------
  test('clicking the × button closes the panel', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await expect(page.locator('.grid-cols-7 button').first()).toBeVisible({ timeout: 15_000 })
    await page.locator('.grid-cols-7 button').first().click()
    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })

    // Click ×
    await panelCloseBtn(page).click()

    // Panel content leaves the DOM
    await expect(panelCloseBtn(page)).not.toBeVisible({ timeout: 5_000 })
  })

  // -------------------------------------------------------------------------
  // Test 3: Backdrop click closes the panel
  // -------------------------------------------------------------------------
  test('clicking the backdrop closes the panel', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await expect(page.locator('.grid-cols-7 button').first()).toBeVisible({ timeout: 15_000 })
    await page.locator('.grid-cols-7 button').first().click()
    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })

    // Click well to the left of the 360px-wide right panel (viewport ≥ 1280px)
    await page.mouse.click(400, 400)

    await expect(panelCloseBtn(page)).not.toBeVisible({ timeout: 5_000 })
  })

  // -------------------------------------------------------------------------
  // Test 4: Clicking the same day cell again toggles the panel closed
  // -------------------------------------------------------------------------
  test('clicking the same day cell a second time closes the panel', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await expect(page.locator('.grid-cols-7 button').first()).toBeVisible({ timeout: 15_000 })

    const firstCell = page.locator('.grid-cols-7 button').first()
    await firstCell.click()
    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })

    // Click the same cell again — force: true because the backdrop (z-40, pointer-events-auto)
    // overlays the calendar when the panel is open; force dispatches directly to the button,
    // which triggers handleSelect(id) → selectedId === id → null (toggle closed).
    await firstCell.click({ force: true })

    await expect(panelCloseBtn(page)).not.toBeVisible({ timeout: 5_000 })
  })

  // -------------------------------------------------------------------------
  // Test 5: Switching to the Night Shift tab closes the panel
  // -------------------------------------------------------------------------
  test('switching to the Night Shift tab closes the panel', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await expect(page.locator('.grid-cols-7 button').first()).toBeVisible({ timeout: 15_000 })
    await page.locator('.grid-cols-7 button').first().click()
    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })

    // Switch shift tab — force: true because the backdrop (z-40) overlays the tab buttons
    // when the panel is open; force dispatches directly to the tab, triggering handleTabSwitch
    // which explicitly clears selectedId → panel closes.
    await page.getByRole('button', { name: 'Night Shift' }).click({ force: true })

    await expect(panelCloseBtn(page)).not.toBeVisible({ timeout: 5_000 })
  })

  // -------------------------------------------------------------------------
  // Test 6: Accordion — only one therapist row expanded at a time
  // -------------------------------------------------------------------------
  test('accordion allows only one therapist row to be expanded at a time', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    // Wait for calendar grid; find the day cell that shows our 2 seeded shifts
    await expect(page.locator('.grid-cols-7 button').first()).toBeVisible({ timeout: 15_000 })

    // The targetDate cell should display "2/2" (2 active / 2 total)
    const targetCell = page.locator('.grid-cols-7 button').filter({ hasText: '2/2' }).first()
    await expect(targetCell).toBeVisible({ timeout: 10_000 })
    await targetCell.click()

    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })

    // Initially no row is expanded — neither unassign button should be present
    await expect(
      page.locator('aside').getByRole('button', { name: 'Remove lead assignment' })
    ).toHaveCount(0)
    await expect(
      page.locator('aside').getByRole('button', { name: 'Unassign therapist' })
    ).toHaveCount(0)

    // Expand therapist1's accordion row (they are the lead)
    await page
      .locator('aside')
      .getByRole('button', { name: new RegExp(ctx!.therapist1.fullName) })
      .click()

    // therapist1 (lead) expanded — "Remove lead assignment" appears; "Unassign therapist" absent
    await expect(
      page.locator('aside').getByRole('button', { name: 'Remove lead assignment' })
    ).toHaveCount(1)
    await expect(
      page.locator('aside').getByRole('button', { name: 'Unassign therapist' })
    ).toHaveCount(0)

    // Expand therapist2's row (staff) — should collapse therapist1
    await page
      .locator('aside')
      .getByRole('button', { name: new RegExp(ctx!.therapist2.fullName) })
      .click()

    // therapist2 (staff) now expanded; therapist1 collapsed
    await expect(
      page.locator('aside').getByRole('button', { name: 'Unassign therapist' })
    ).toHaveCount(1)
    await expect(
      page.locator('aside').getByRole('button', { name: 'Remove lead assignment' })
    ).toHaveCount(0)
  })

  // -------------------------------------------------------------------------
  // Test 7: Assign a staff therapist to a clean day
  // -------------------------------------------------------------------------
  test('assigning a therapist adds them to the panel list', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await expect(page.locator('.grid-cols-7 button').first()).toBeVisible({ timeout: 15_000 })

    // Open the first clean (0/0) day cell
    const cleanCell = page.locator('.grid-cols-7 button').filter({ hasText: '0/0' }).first()
    await expect(cleanCell).toBeVisible({ timeout: 10_000 })
    await cleanCell.click()
    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })

    // Select therapist2 in the dropdown and click Assign
    const select = page.locator('aside select')
    await expect(select).toBeVisible()
    await select.selectOption({ label: ctx!.therapist2.fullName })
    await page.locator('aside').getByRole('button', { name: 'Assign' }).click()

    // therapist2 should appear as a row in the panel list
    await expect(
      page.locator('aside').getByRole('button', { name: new RegExp(ctx!.therapist2.fullName) })
    ).toBeVisible({ timeout: 10_000 })
  })

  // -------------------------------------------------------------------------
  // Test 8: Duplicate assign shows inline error — no browser dialog
  // -------------------------------------------------------------------------
  test('duplicate assign shows an inline error message instead of a browser dialog', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    // Intercept the Supabase shifts POST and return a 23505 duplicate-key error.
    // This tests that the UI renders an inline [role="alert"] rather than calling window.alert().
    // Playwright throws automatically if window.alert fires, so reaching the assertion proves
    // no dialog was triggered.
    await page.route('**/rest/v1/shifts**', async (route, request) => {
      if (request.method() === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '23505',
            message: 'duplicate key value violates unique constraint',
            details: null,
            hint: null,
          }),
        })
      } else {
        await route.continue()
      }
    })

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await expect(page.locator('.grid-cols-7 button').first()).toBeVisible({ timeout: 15_000 })

    // Open a clean day cell (Test 7 used .first(), so pick the next 0/0 cell)
    const cleanCell = page.locator('.grid-cols-7 button').filter({ hasText: '0/0' }).first()
    await expect(cleanCell).toBeVisible({ timeout: 10_000 })
    await cleanCell.click()
    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })

    // Click Assign — the intercepted POST returns 23505
    const select = page.locator('aside select')
    await expect(select).toBeVisible()
    await page.locator('aside').getByRole('button', { name: 'Assign' }).click()

    // Inline error should appear inside the panel (not a browser dialog)
    const errorEl = page.locator('aside [role="alert"]')
    await expect(errorEl).toBeVisible({ timeout: 5_000 })
    await expect(errorEl).toContainText('already assigned')
  })

  // -------------------------------------------------------------------------
  // Test 9: Lead toggle filters dropdown to lead-eligible therapists only
  // -------------------------------------------------------------------------
  test('switching to Lead role filters the assign dropdown to lead-eligible therapists', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await expect(page.locator('.grid-cols-7 button').first()).toBeVisible({ timeout: 15_000 })

    // assignDate2 = start + 15 — index 15 in the calendar grid, guaranteed clean
    const cleanCell = page.locator('.grid-cols-7 button').nth(15)
    await expect(cleanCell).toBeVisible({ timeout: 10_000 })
    await cleanCell.click()
    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })

    const select = page.locator('aside select')
    await expect(select).toBeVisible()

    // In Staff mode (default): both therapists visible in dropdown
    const staffOptionTexts = await select.locator('option').allTextContents()
    expect(staffOptionTexts.some((o) => o.includes(ctx!.therapist1.fullName))).toBe(true)
    expect(staffOptionTexts.some((o) => o.includes(ctx!.therapist2.fullName))).toBe(true)

    // Switch to Lead role
    await page.locator('aside').getByRole('button', { name: 'Lead' }).click()

    // In Lead mode: only lead-eligible therapist1 is in the dropdown
    const leadOptionTexts = await select.locator('option').allTextContents()
    expect(leadOptionTexts.some((o) => o.includes(ctx!.therapist1.fullName))).toBe(true)
    expect(leadOptionTexts.some((o) => o.includes(ctx!.therapist2.fullName))).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Test 10: Status change updates the therapist row label
  // -------------------------------------------------------------------------
  test('changing a therapist status to On Call updates their status label in the panel', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await expect(page.locator('.grid-cols-7 button').first()).toBeVisible({ timeout: 15_000 })

    // Open the targetDate cell (2 pre-seeded shifts)
    const targetCell = page.locator('.grid-cols-7 button').filter({ hasText: '2/2' }).first()
    await expect(targetCell).toBeVisible({ timeout: 10_000 })
    await targetCell.click()
    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })

    // Expand therapist2's row (staff shift)
    await page
      .locator('aside')
      .getByRole('button', { name: new RegExp(ctx!.therapist2.fullName) })
      .click()

    // Click the "On Call" status button
    await page.locator('aside').getByRole('button', { name: 'On Call' }).click()

    // The status label inside therapist2's row button should update to "On Call"
    await expect(
      page
        .locator('aside')
        .getByRole('button', { name: new RegExp(ctx!.therapist2.fullName) })
        .locator('p.text-xs.font-semibold')
    ).toContainText('On Call', { timeout: 5_000 })
  })

  // -------------------------------------------------------------------------
  // Test 11: Assign as Lead role — Lead row appears and DB records role='lead'
  // -------------------------------------------------------------------------
  test('assigning as Lead role creates a lead row in the panel and persists to the DB', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await expect(page.locator('.grid-cols-7 button').first()).toBeVisible({ timeout: 15_000 })

    // assignDate2 is at calendar index 15 (start + 15) — guaranteed clean
    const assignCell = page.locator('.grid-cols-7 button').nth(15)
    await expect(assignCell).toBeVisible({ timeout: 10_000 })
    await assignCell.click()
    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })

    // Switch to Lead role in the assign panel
    await page.locator('aside').getByRole('button', { name: 'Lead' }).click()

    // Select therapist1 (lead-eligible) and assign
    const select = page.locator('aside select')
    await expect(select).toBeVisible()
    await select.selectOption({ value: ctx!.therapist1.id })
    await page.locator('aside').getByRole('button', { name: 'Assign' }).click()

    // therapist1 should appear as a row in the panel
    const t1Row = page
      .locator('aside')
      .getByRole('button', { name: new RegExp(ctx!.therapist1.fullName) })
    await expect(t1Row).toBeVisible({ timeout: 10_000 })

    // Expanding their row should show "Remove lead assignment" — confirming the Lead role
    await t1Row.click()
    await expect(
      page.locator('aside').getByRole('button', { name: 'Remove lead assignment' })
    ).toBeVisible({ timeout: 5_000 })

    // DB: the inserted shift must have role='lead'
    const { data: leadShifts } = await ctx!.supabase
      .from('shifts')
      .select('role')
      .eq('user_id', ctx!.therapist1.id)
      .eq('cycle_id', ctx!.cycle.id)
      .eq('date', ctx!.assignDate2)
      .eq('role', 'lead')
    expect(leadShifts?.length).toBeGreaterThanOrEqual(1)
  })

  // -------------------------------------------------------------------------
  // Test 12: Status change persists when the panel is closed and reopened
  // -------------------------------------------------------------------------
  test('On Call status set in test 10 persists when the panel is closed and reopened', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await expect(page.locator('.grid-cols-7 button').first()).toBeVisible({ timeout: 15_000 })

    // targetDate still has 2/2 (test 13 hasn't unassigned therapist2 yet)
    const targetCell = page.locator('.grid-cols-7 button').filter({ hasText: '2/2' }).first()
    await expect(targetCell).toBeVisible({ timeout: 10_000 })
    await targetCell.click()
    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })

    // Expand therapist2 — status should be "On Call" (saved to DB by test 10)
    const t2Btn = page
      .locator('aside')
      .getByRole('button', { name: new RegExp(ctx!.therapist2.fullName) })
    await t2Btn.click()
    await expect(t2Btn.locator('p.text-xs.font-semibold')).toContainText('On Call', {
      timeout: 5_000,
    })

    // Close the panel, then reopen the same day
    await panelCloseBtn(page).click()
    await expect(panelCloseBtn(page)).not.toBeVisible({ timeout: 5_000 })

    await targetCell.click()
    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })

    // Status must still be "On Call" after re-open (not reset to Active)
    const t2BtnReopen = page
      .locator('aside')
      .getByRole('button', { name: new RegExp(ctx!.therapist2.fullName) })
    await t2BtnReopen.click()
    await expect(t2BtnReopen.locator('p.text-xs.font-semibold')).toContainText('On Call', {
      timeout: 5_000,
    })
  })

  // -------------------------------------------------------------------------
  // Test 13: Unassign therapist removes their row from the panel
  // -------------------------------------------------------------------------
  test('unassigning a therapist removes their row from the panel and deletes the DB shift', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await expect(page.locator('.grid-cols-7 button').first()).toBeVisible({ timeout: 15_000 })

    const targetCell = page.locator('.grid-cols-7 button').filter({ hasText: '2/2' }).first()
    await expect(targetCell).toBeVisible({ timeout: 10_000 })
    await targetCell.click()
    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })

    // Expand therapist2 and unassign
    await page
      .locator('aside')
      .getByRole('button', { name: new RegExp(ctx!.therapist2.fullName) })
      .click()
    await page.locator('aside').getByRole('button', { name: 'Unassign therapist' }).click()

    // therapist2 row should disappear from the panel
    await expect(
      page.locator('aside').getByRole('button', { name: new RegExp(ctx!.therapist2.fullName) })
    ).toHaveCount(0, { timeout: 10_000 })

    // DB: no shift should remain for therapist2 on targetDate
    const { data: remaining } = await ctx!.supabase
      .from('shifts')
      .select('id')
      .eq('user_id', ctx!.therapist2.id)
      .eq('cycle_id', ctx!.cycle.id)
      .eq('date', ctx!.targetDate)
    expect(remaining?.length ?? 0).toBe(0)
  })

  // -------------------------------------------------------------------------
  // Test 14: Workload warning appears when a therapist is at their weekly limit
  // -------------------------------------------------------------------------
  test('selecting a therapist at their weekly limit shows the workload warning banner', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    // therapist3 (PRN, max 1 shift/week) has a pre-seeded night shift on targetDate.
    // weeklyTherapistCounts spans dayDays + nightDays, so their weekly count = 1 = limit.
    // Opening the Day tab for targetDate and selecting them triggers the role="status" warning.

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await expect(page.locator('.grid-cols-7 button').first()).toBeVisible({ timeout: 15_000 })

    // targetDate is at calendar index 5 (cycle start + 5).
    // After test 13 unassigned therapist2, this cell shows 1/1 (therapist1 only).
    const targetCell = page.locator('.grid-cols-7 button').nth(5)
    await expect(targetCell).toBeVisible({ timeout: 10_000 })
    await targetCell.click()
    await expect(panelCloseBtn(page)).toBeVisible({ timeout: 5_000 })

    // Select therapist3 — they are eligible for day shifts (day profile) and not yet assigned
    // to this day slot, so they appear in the dropdown.
    const select = page.locator('aside select')
    await expect(select).toBeVisible()
    await select.selectOption({ value: ctx!.therapist3.id })

    // Workload warning (role="status") should appear immediately after selection
    const warning = page.locator('aside [role="status"]')
    await expect(warning).toBeVisible({ timeout: 5_000 })
    await expect(warning).toContainText(ctx!.therapist3.fullName)
    await expect(warning).toContainText('1 of 1')
  })
})
