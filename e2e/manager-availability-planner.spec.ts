import { expect, test, type Locator, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  leadTherapist: { id: string }
  therapist: { id: string; fullName: string }
  prnTherapist: { id: string; fullName: string }
  cycle: { id: string }
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

function randomString(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

async function createUser(
  supabase: SupabaseClient,
  payload: {
    email: string
    password: string
    fullName: string
    role: 'manager' | 'therapist' | 'lead'
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
      is_lead_eligible: payload.isLeadEligible ?? payload.role === 'lead',
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

async function createCycle(supabase: SupabaseClient) {
  const label = `Planner E2E ${randomString('cycle')}`
  const { data, error } = await supabase
    .from('schedule_cycles')
    .insert({
      label,
      start_date: '2026-03-22',
      end_date: '2026-03-28',
      published: false,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Could not create test cycle: ${error?.message ?? 'unknown error'}`)
  }

  return { id: data.id }
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/, { timeout: 30_000 })
}

test.describe.serial('/availability manager planner', () => {
  let ctx: TestContext | null = null
  const createdUserIds: string[] = []

  test.beforeAll(async () => {
    const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const managerEmail = `${randomString('planner-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const manager = await createUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'E2E Planner Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const leadTherapist = await createUser(supabase, {
      email: `${randomString('planner-lead')}@example.com`,
      password: `Lead!${Math.random().toString(16).slice(2, 8)}`,
      fullName: 'E2E Lead Therapist',
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const therapistFullName = `E2E Planner Therapist ${randomString('ther')}`
    const therapist = await createUser(supabase, {
      email: `${randomString('planner-ther')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    const prnFullName = `E2E Planner PRN ${randomString('prn')}`
    const prnTherapist = await createUser(supabase, {
      email: `${randomString('planner-prn')}@example.com`,
      password: `Prn!${Math.random().toString(16).slice(2, 8)}`,
      fullName: prnFullName,
      role: 'therapist',
      employmentType: 'prn',
      shiftType: 'day',
      isLeadEligible: false,
    })

    const cycle = await createCycle(supabase)

    createdUserIds.push(manager.id, leadTherapist.id, therapist.id, prnTherapist.id)
    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      leadTherapist,
      therapist: { id: therapist.id, fullName: therapistFullName },
      prnTherapist: { id: prnTherapist.id, fullName: prnFullName },
      cycle,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return
    await ctx.supabase.from('availability_overrides').delete().eq('cycle_id', ctx.cycle.id)
    await ctx.supabase.from('shifts').delete().eq('cycle_id', ctx.cycle.id)
    await ctx.supabase.from('schedule_cycles').delete().eq('id', ctx.cycle.id)
    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
  })

  test('manager can save hard dates and auto-draft honors them', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/availability?cycle=${ctx!.cycle.id}&therapist=${ctx!.therapist.id}`)

    const planner = page.locator('#staff-scheduling-inputs')
    await expect(planner.getByText('Staff Scheduling Inputs').first()).toBeVisible()
    const calendarDay = (root: Locator, day: string) =>
      root
        .locator('button')
        .filter({ hasText: new RegExp(`^${day}$`) })
        .first()

    await planner.getByLabel('Therapist').selectOption(ctx!.therapist.id)
    await calendarDay(planner, '24').click()
    await calendarDay(planner, '26').click()
    await planner.getByRole('button', { name: 'Save Will work' }).click()

    await expect(page).toHaveURL(
      new RegExp(
        `/availability\\?cycle=${ctx!.cycle.id}&therapist=${ctx!.therapist.id}&success=planner_saved`
      )
    )
    await expect(
      page.getByRole('alert').filter({ hasText: 'Staff scheduling inputs saved.' })
    ).toBeVisible()

    const refreshedPlanner = page.locator('#staff-scheduling-inputs')
    await refreshedPlanner.getByRole('button', { name: 'Cannot work' }).click()
    await calendarDay(refreshedPlanner, '26').click()
    await refreshedPlanner.getByRole('button', { name: 'Save Cannot work' }).click()

    await expect(page).toHaveURL(
      new RegExp(
        `/availability\\?cycle=${ctx!.cycle.id}&therapist=${ctx!.therapist.id}&success=planner_saved`
      )
    )

    await page.goto(`/availability?cycle=${ctx!.cycle.id}&therapist=${ctx!.prnTherapist.id}`)
    const prnPlanner = page.locator('#staff-scheduling-inputs')
    await prnPlanner.getByLabel('Therapist').selectOption(ctx!.prnTherapist.id)
    await calendarDay(prnPlanner, '25').click()
    await prnPlanner.getByRole('button', { name: 'Save Will work' }).click()

    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)
    await page.getByRole('button', { name: 'Auto-draft' }).click()
    await expect(page).toHaveURL(/auto=generated/, { timeout: 30_000 })

    const shiftsResult = await ctx!.supabase
      .from('shifts')
      .select('user_id, date, shift_type')
      .eq('cycle_id', ctx!.cycle.id)
      .in('user_id', [ctx!.leadTherapist.id, ctx!.therapist.id, ctx!.prnTherapist.id])

    expect(shiftsResult.error).toBeNull()
    const shifts = shiftsResult.data ?? []

    expect(
      shifts.some((row) => row.user_id === ctx!.therapist.id && row.date === '2026-03-24')
    ).toBe(true)
    expect(
      shifts.some((row) => row.user_id === ctx!.therapist.id && row.date === '2026-03-26')
    ).toBe(false)
    expect(
      shifts.some((row) => row.user_id === ctx!.prnTherapist.id && row.date === '2026-03-25')
    ).toBe(true)
  })
})
