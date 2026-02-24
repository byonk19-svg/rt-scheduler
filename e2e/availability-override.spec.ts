import { expect, test } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string; fullName: string }
  fullTimeTherapist: { id: string; fullName: string }
  prnTherapist: { id: string; fullName: string }
  cycle: { id: string; startDate: string; endDate: string }
  targetDate: string
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
      if ((parsedValue.startsWith('"') && parsedValue.endsWith('"')) || (parsedValue.startsWith("'") && parsedValue.endsWith("'"))) {
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
    throw new Error(`Could not create test user ${payload.email}: ${createResult.error?.message ?? 'unknown error'}`)
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

async function login(page: Parameters<typeof test>[0]['page'], email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(/\/dashboard\//, { timeout: 30_000 })
}

test.describe.serial('availability override scheduling', () => {
  let ctx: TestContext | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const managerEmail = `${randomString('manager')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const managerFullName = 'E2E Manager'
    const manager = await createUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: managerFullName,
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const therapistFullName = 'E2E Full Time Therapist'
    const therapist = await createUser(supabase, {
      email: `${randomString('therapist')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
    })

    const prnFullName = 'E2E PRN Therapist'
    const prnTherapist = await createUser(supabase, {
      email: `${randomString('prn')}@example.com`,
      password: `Prn!${Math.random().toString(16).slice(2, 8)}`,
      fullName: prnFullName,
      role: 'therapist',
      employmentType: 'prn',
      shiftType: 'day',
    })

    createdUserIds.push(manager.id, therapist.id, prnTherapist.id)

    const start = new Date()
    start.setDate(start.getDate() - 1)
    const end = new Date()
    end.setDate(end.getDate() + 7)
    const targetDate = formatDateKey(start)

    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: randomString('E2E Cycle'),
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

    const availabilityInsert = await supabase.from('availability_entries').insert({
      therapist_id: therapist.id,
      cycle_id: cycleInsert.data.id,
      date: targetDate,
      shift_type: 'both',
      entry_type: 'unavailable',
      reason: 'Vacation',
      created_by: therapist.id,
    })

    if (availabilityInsert.error) {
      throw new Error(`Could not seed availability entry: ${availabilityInsert.error.message}`)
    }

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword, fullName: managerFullName },
      fullTimeTherapist: { id: therapist.id, fullName: therapistFullName },
      prnTherapist: { id: prnTherapist.id, fullName: prnFullName },
      cycle: {
        id: cycleInsert.data.id,
        startDate: cycleInsert.data.start_date,
        endDate: cycleInsert.data.end_date,
      },
      targetDate,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    for (const cycleId of createdCycleIds) {
      await ctx.supabase.from('shifts').delete().eq('cycle_id', cycleId)
      await ctx.supabase.from('availability_entries').delete().eq('cycle_id', cycleId)
      await ctx.supabase.from('schedule_cycles').delete().eq('id', cycleId)
    }

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
  })

  test('unavailable assignment shows warning modal; cancel prevents assignment; confirm writes override', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/schedule?cycle=${ctx!.cycle.id}&view=calendar`)

    await page.getByRole('button', { name: 'Manage shift staffing' }).click()
    const shiftDialog = page.getByRole('dialog', { name: /Day Shift|Night Shift/ })
    await expect(shiftDialog).toBeVisible()

    await shiftDialog.locator('select').nth(1).selectOption(ctx!.fullTimeTherapist.id)
    await shiftDialog.getByRole('button', { name: 'Add staff' }).click()

    const conflictDialog = page.getByRole('dialog', { name: 'Conflicts with availability' })
    await expect(conflictDialog).toBeVisible()
    await expect(conflictDialog).toContainText('marked unavailable')
    await conflictDialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(conflictDialog).toBeHidden()

    const noShiftResult = await ctx!.supabase
      .from('shifts')
      .select('id')
      .eq('cycle_id', ctx!.cycle.id)
      .eq('user_id', ctx!.fullTimeTherapist.id)
      .eq('date', ctx!.targetDate)
      .eq('shift_type', 'day')
    expect(noShiftResult.error).toBeNull()
    expect(noShiftResult.data ?? []).toHaveLength(0)

    await shiftDialog.locator('select').nth(1).selectOption(ctx!.fullTimeTherapist.id)
    await shiftDialog.getByRole('button', { name: 'Add staff' }).click()
    await expect(conflictDialog).toBeVisible()
    await conflictDialog.locator('#availability-override-reason').fill('Coverage emergency')
    const overrideResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/schedule/drag-drop') &&
        response.request().method() === 'POST' &&
        response.status() === 200
    )
    await conflictDialog.getByRole('button', { name: 'Assign anyway' }).click()
    const overrideResponse = await overrideResponsePromise
    const overridePayload = await overrideResponse.json()
    expect(overridePayload?.message).toBe('Shift assigned.')

    const assignedShiftResult = await ctx!.supabase
      .from('shifts')
      .select('availability_override, availability_override_reason, availability_override_by, availability_override_at')
      .eq('cycle_id', ctx!.cycle.id)
      .eq('user_id', ctx!.fullTimeTherapist.id)
      .eq('date', ctx!.targetDate)
      .eq('shift_type', 'day')
      .single()

    expect(assignedShiftResult.error).toBeNull()
    expect(assignedShiftResult.data?.availability_override).toBe(true)
    expect(assignedShiftResult.data?.availability_override_reason).toBe('Coverage emergency')
    expect(assignedShiftResult.data?.availability_override_by).toBe(ctx!.manager.id)
    expect(assignedShiftResult.data?.availability_override_at).toBeTruthy()
  })

  test('PRN not offered is a soft warning only', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/schedule?cycle=${ctx!.cycle.id}&view=calendar`)

    await page.getByRole('button', { name: 'Show staffing pool' }).click()
    await expect(page.getByText('Not offered (PRN)').first()).toBeVisible()

    await page.getByRole('button', { name: 'Manage shift staffing' }).click()
    const shiftDialog = page.getByRole('dialog', { name: /Day Shift|Night Shift/ })
    await expect(shiftDialog).toBeVisible()

    await shiftDialog.locator('select').nth(1).selectOption(ctx!.prnTherapist.id)
    const prnAssignResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/schedule/drag-drop') &&
        response.request().method() === 'POST' &&
        response.status() === 200
    )
    await shiftDialog.getByRole('button', { name: 'Add staff' }).click()
    const prnAssignResponse = await prnAssignResponsePromise
    const prnPayload = await prnAssignResponse.json()
    expect(prnPayload?.message).toBe('Shift assigned.')

    const assignedShiftResult = await ctx!.supabase
      .from('shifts')
      .select('availability_override, availability_override_reason')
      .eq('cycle_id', ctx!.cycle.id)
      .eq('user_id', ctx!.prnTherapist.id)
      .eq('date', ctx!.targetDate)
      .eq('shift_type', 'day')
      .single()

    expect(assignedShiftResult.error).toBeNull()
    expect(assignedShiftResult.data?.availability_override).toBe(false)
    expect(assignedShiftResult.data?.availability_override_reason).toBeNull()
  })
})
