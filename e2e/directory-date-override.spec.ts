import { expect, test, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Shared helpers (mirrors availability-override.spec.ts)
// ---------------------------------------------------------------------------

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string; fullName: string }
  therapist: { id: string; email: string; fullName: string }
  cycle: { id: string; startDate: string; endDate: string }
  targetDate: string
  preSeededOverrideDate: string
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

test.describe.serial('manager date-override workflow in /directory', () => {
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

    const managerEmail = `${randomString('dir-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const managerFullName = 'E2E Dir Manager'
    const manager = await createUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: managerFullName,
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const therapistFullName = `E2E Dir Therapist ${randomString('t')}`
    const therapistEmail = `${randomString('dir-ther')}@example.com`
    const therapist = await createUser(supabase, {
      email: therapistEmail,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
    })

    createdUserIds.push(manager.id, therapist.id)

    // Cycle: yesterday → yesterday + 41 days
    const start = new Date()
    start.setDate(start.getDate() - 1)
    const end = new Date(start)
    end.setDate(end.getDate() + 41)

    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: randomString('E2E Dir Cycle'),
        start_date: formatDateKey(start),
        end_date: formatDateKey(end),
        published: false,
      })
      .select('id, start_date, end_date')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(`Could not create test cycle: ${cycleInsert.error?.message ?? 'unknown error'}`)
    }

    createdCycleIds.push(cycleInsert.data.id)

    // Date used in the "add" test (start + 5 days)
    const targetDateObj = new Date(start)
    targetDateObj.setDate(targetDateObj.getDate() + 5)
    const targetDate = formatDateKey(targetDateObj)

    // Pre-seed an override for the "delete" test (start + 3 days)
    const preSeededDateObj = new Date(start)
    preSeededDateObj.setDate(preSeededDateObj.getDate() + 3)
    const preSeededOverrideDate = formatDateKey(preSeededDateObj)

    const overrideInsert = await supabase.from('availability_overrides').insert({
      therapist_id: therapist.id,
      cycle_id: cycleInsert.data.id,
      date: preSeededOverrideDate,
      shift_type: 'both',
      override_type: 'force_off',
      note: 'Pre-seeded for delete test',
      created_by: manager.id,
      source: 'manager',
    })

    if (overrideInsert.error) {
      throw new Error(`Could not seed override: ${overrideInsert.error.message}`)
    }

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword, fullName: managerFullName },
      therapist: { id: therapist.id, email: therapistEmail, fullName: therapistFullName },
      cycle: {
        id: cycleInsert.data.id,
        startDate: cycleInsert.data.start_date,
        endDate: cycleInsert.data.end_date,
      },
      targetDate,
      preSeededOverrideDate,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return
    for (const cycleId of createdCycleIds) {
      await ctx.supabase.from('availability_overrides').delete().eq('cycle_id', cycleId)
      await ctx.supabase.from('schedule_cycles').delete().eq('id', cycleId)
    }
    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
  })

  // -------------------------------------------------------------------------
  // Test 1: Add a date override via the employee drawer form
  // -------------------------------------------------------------------------
  test('can add a date override for a therapist and see it reflected in the DB', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/directory')

    // Open employee drawer by clicking the therapist's table row
    // Click the employee directory row (contains email); avoids the Missing Availability row
    await page
      .getByRole('row')
      .filter({ hasText: ctx!.therapist.email })
      .click()
    const drawer = page.getByRole('dialog', { name: 'Edit employee' })
    await expect(drawer).toBeVisible({ timeout: 10_000 })

    // Scroll to the override form and fill it
    await page.locator('#override_date').scrollIntoViewIfNeeded()
    await page.locator('#override_date').fill(ctx!.targetDate)
    await page.locator('#override_cycle_id').selectOption(ctx!.cycle.id)
    await page.locator('#override_type').selectOption('force_off')
    await page.locator('#override_shift_type').selectOption('both')
    await page.locator('#override_note').fill('E2E vacation test')

    // Submit and wait for server action redirect
    await page.getByRole('button', { name: 'Save date override' }).click()
    await expect(page).toHaveURL(/success=override_saved/, { timeout: 15_000 })

    // Assert success toast (filter to avoid matching Next.js route announcer)
    await expect(
      page.getByRole('alert').filter({ hasText: 'Date override saved.' })
    ).toBeVisible()

    // Verify DB: override exists with correct fields
    const result = await ctx!.supabase
      .from('availability_overrides')
      .select('override_type, shift_type, note, source, created_by')
      .eq('therapist_id', ctx!.therapist.id)
      .eq('cycle_id', ctx!.cycle.id)
      .eq('date', ctx!.targetDate)
      .single()

    expect(result.error).toBeNull()
    expect(result.data?.override_type).toBe('force_off')
    expect(result.data?.shift_type).toBe('both')
    expect(result.data?.note).toBe('E2E vacation test')
    expect(result.data?.source).toBe('manager')
    expect(result.data?.created_by).toBe(ctx!.manager.id)
  })

  // -------------------------------------------------------------------------
  // Test 2: Delete a date override from the employee drawer
  // -------------------------------------------------------------------------
  test('can delete a pre-existing date override and see it removed from the DB', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/directory')

    // Open employee drawer
    // Click the employee directory row (contains email); avoids the Missing Availability row
    await page
      .getByRole('row')
      .filter({ hasText: ctx!.therapist.email })
      .click()
    const drawer = page.getByRole('dialog', { name: 'Edit employee' })
    await expect(drawer).toBeVisible({ timeout: 10_000 })

    // Scroll to the overrides list and click Delete on the pre-seeded override
    await page.getByRole('button', { name: 'Delete' }).first().scrollIntoViewIfNeeded()
    await page.getByRole('button', { name: 'Delete' }).first().click()

    // Wait for the server action redirect (URL gains ?success=override_deleted)
    await expect(page).toHaveURL(/success=override_deleted/, { timeout: 15_000 })

    // Verify DB: pre-seeded override is gone
    const result = await ctx!.supabase
      .from('availability_overrides')
      .select('id')
      .eq('therapist_id', ctx!.therapist.id)
      .eq('cycle_id', ctx!.cycle.id)
      .eq('date', ctx!.preSeededOverrideDate)

    expect(result.error).toBeNull()
    expect(result.data ?? []).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // Test 3: "Enter availability" quick action opens drawer focused on overrides
  // -------------------------------------------------------------------------
  test('"Enter availability" quick action opens drawer with override form visible', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/directory')

    // The Missing Availability section is expanded by default (collapsedMissing=false).
    // Wait for at least one "Enter availability" button to be visible, then click it.
    await expect(
      page.getByRole('button', { name: 'Enter availability' }).first()
    ).toBeVisible({ timeout: 15_000 })

    // Click "Enter availability" for the therapist
    await page.getByRole('button', { name: 'Enter availability' }).first().click()

    // Drawer must open
    const drawer = page.getByRole('dialog', { name: 'Edit employee' })
    await expect(drawer).toBeVisible()

    // The override form date input must be visible (section was scrolled into view)
    await expect(page.locator('#override_date')).toBeVisible({ timeout: 5_000 })
  })
})
