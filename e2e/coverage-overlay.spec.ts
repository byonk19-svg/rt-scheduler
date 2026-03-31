import { expect, test, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  therapist1: { id: string; fullName: string }
  therapist2: { id: string; fullName: string }
  therapist3: { id: string; fullName: string }
  cycle: { id: string }
  targetDate: string
  assignDate: string
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
  await expect(page).toHaveURL(/\/dashboard(?:[/?].*)?$/, { timeout: 30_000 })
}

test.describe.serial('coverage manager dialog interactions', () => {
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

    const targetDateObj = new Date(start)
    targetDateObj.setDate(targetDateObj.getDate() + 5)
    const targetDate = formatDateKey(targetDateObj)

    const assignDateObj = new Date(start)
    assignDateObj.setDate(assignDateObj.getDate() + 15)
    const assignDate = formatDateKey(assignDateObj)

    const shiftsInsert = await supabase.from('shifts').insert([
      {
        cycle_id: cycleInsert.data.id,
        user_id: therapist1.id,
        date: targetDate,
        shift_type: 'day',
        role: 'lead',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: cycleInsert.data.id,
        user_id: therapist2.id,
        date: targetDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      },
      {
        cycle_id: cycleInsert.data.id,
        user_id: therapist3.id,
        date: targetDate,
        shift_type: 'night',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
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
      assignDate,
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

  function dayCell(page: Page, isoDate: string) {
    return page.getByTestId(`coverage-day-panel-${isoDate}`)
  }

  function dayCellButton(page: Page, isoDate: string) {
    return page.getByTestId(`coverage-day-cell-button-${isoDate}`)
  }

  function shiftEditorDialog(page: Page) {
    return page.getByTestId('coverage-shift-editor-dialog')
  }

  function statusPopover(page: Page) {
    return page.getByTestId('coverage-status-popover')
  }

  async function waitForCalendar(page: Page, isoDate: string) {
    await expect(dayCell(page, isoDate)).toBeVisible({ timeout: 15_000 })
  }

  async function openShiftEditor(page: Page, isoDate: string) {
    await dayCellButton(page, isoDate).click({ position: { x: 18, y: 18 } })
    await expect(shiftEditorDialog(page)).toBeVisible({ timeout: 5_000 })
  }

  test('clicking a day cell background opens the shift editor dialog', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await waitForCalendar(page, ctx!.targetDate)
    await openShiftEditor(page, ctx!.targetDate)
    await expect(page.getByTestId('coverage-drawer-close')).toHaveCount(0)
  })

  test('clicking an assigned therapist opens the status popover only', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await waitForCalendar(page, ctx!.targetDate)
    await page
      .getByTestId(`coverage-assignment-trigger-${ctx!.targetDate}-${ctx!.therapist1.id}`)
      .click()

    await expect(statusPopover(page)).toBeVisible({ timeout: 5_000 })
    await expect(shiftEditorDialog(page)).toHaveCount(0)
  })

  test('clicking the Close button dismisses the shift editor dialog', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await waitForCalendar(page, ctx!.targetDate)
    await openShiftEditor(page, ctx!.targetDate)

    await shiftEditorDialog(page).getByRole('button', { name: 'Close' }).click()
    await expect(shiftEditorDialog(page)).toHaveCount(0)
  })

  test('assigning and unassigning a therapist works through the shift editor dialog', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycle.id}`)

    await waitForCalendar(page, ctx!.assignDate)
    await openShiftEditor(page, ctx!.assignDate)

    await expect(
      page.getByTestId(`coverage-assign-toggle-${ctx!.therapist2.id}-staff`)
    ).toBeVisible()
    await page.getByTestId(`coverage-assign-toggle-${ctx!.therapist2.id}-staff`).click()
    const unassignButton = page.getByRole('button', {
      name: `Unassign ${ctx!.therapist2.fullName}`,
    })
    await expect(unassignButton).toBeVisible()

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('shifts')
          .select('id')
          .eq('cycle_id', ctx!.cycle.id)
          .eq('user_id', ctx!.therapist2.id)
          .eq('date', ctx!.assignDate)
          .eq('shift_type', 'day')
        if (result.error) throw new Error(result.error.message)
        return result.data?.length ?? 0
      })
      .toBe(1)

    await unassignButton.click()
    await expect(
      page.getByTestId(`coverage-assign-toggle-${ctx!.therapist2.id}-staff`)
    ).toBeVisible()

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('shifts')
          .select('id')
          .eq('cycle_id', ctx!.cycle.id)
          .eq('user_id', ctx!.therapist2.id)
          .eq('date', ctx!.assignDate)
          .eq('shift_type', 'day')
        if (result.error) throw new Error(result.error.message)
        return result.data?.length ?? 0
      })
      .toBe(0)
  })
})
