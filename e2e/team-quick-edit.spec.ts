import { expect, test, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  therapist: { id: string; fullName: string }
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
    role: 'manager' | 'therapist'
    employmentType: 'full_time' | 'part_time' | 'prn'
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
  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/, { timeout: 30_000 })
}

test.describe.serial('/team quick edit modal', () => {
  let ctx: TestContext | null = null
  const createdUserIds: string[] = []

  test.beforeAll(async () => {
    const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const managerEmail = `${randomString('team-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const manager = await createUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'E2E Team Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })

    const therapistFullName = `E2E Team Therapist ${randomString('ther')}`
    const therapist = await createUser(supabase, {
      email: `${randomString('team-ther')}@example.com`,
      password: `Ther!${Math.random().toString(16).slice(2, 8)}`,
      fullName: therapistFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    createdUserIds.push(manager.id, therapist.id)
    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      therapist: { id: therapist.id, fullName: therapistFullName },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return
    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId)
    }
  })

  test('manager can regroup, deactivate, and archive a team member from the team roster', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    const updatedName = `${ctx!.therapist.fullName} Updated`

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/team')

    await expect(page.getByRole('heading', { name: 'Managers' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Day Shift' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Night Shift' })).toBeVisible()

    await page.getByRole('button').filter({ hasText: ctx!.therapist.fullName }).first().click()

    const dialog = page.getByRole('dialog', { name: 'Quick Edit Team Member' })
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    await expect(dialog.getByText('Coverage lead')).toHaveCount(0)

    await dialog.getByLabel('Name').fill(updatedName)
    await dialog.getByLabel('Role').selectOption('lead')
    await dialog.getByLabel('Shift').selectOption('night')
    await dialog.getByLabel('Employment Type').selectOption('part_time')
    await dialog.getByLabel('On FMLA').check()
    await dialog.getByLabel('FMLA Return Date').fill('2026-05-12')
    await dialog.getByRole('button', { name: 'Save changes' }).click()

    await expect(page).toHaveURL(/\/team\?success=profile_saved/, { timeout: 15_000 })
    await expect(page.getByRole('alert').filter({ hasText: 'Team member updated.' })).toBeVisible()

    const updatedCard = page.getByRole('button').filter({ hasText: updatedName }).first()
    await expect(updatedCard).toBeVisible()
    await expect(updatedCard).toContainText('Lead Therapist')
    await expect(updatedCard).toContainText('Night shift')
    await expect(updatedCard).toContainText('Part-time')
    await expect(updatedCard).toContainText('Return May 12, 2026')

    await updatedCard.click()
    const inactiveDialog = page.getByRole('dialog', { name: 'Quick Edit Team Member' })
    await inactiveDialog.getByLabel('Active').uncheck()
    await inactiveDialog.getByRole('button', { name: 'Save changes' }).click()

    await expect(page).toHaveURL(/\/team\?success=profile_saved/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Inactive' })).toBeVisible()

    const inactiveCard = page.getByRole('button').filter({ hasText: updatedName }).first()
    await inactiveCard.click()
    const archiveDialog = page.getByRole('dialog', { name: 'Quick Edit Team Member' })
    await expect(archiveDialog.getByText('No app access while inactive.')).toBeVisible()
    await expect(
      archiveDialog.getByText('This updates automatically from the selected role.')
    ).toHaveCount(0)
    await archiveDialog.getByRole('button', { name: 'Archive employee' }).click()

    await expect(page).toHaveURL(/\/team\?success=profile_archived/, { timeout: 15_000 })
    await expect(page.getByRole('alert').filter({ hasText: 'Team member archived.' })).toBeVisible()
    await expect(page.getByRole('button').filter({ hasText: updatedName })).toHaveCount(0)

    const result = await ctx!.supabase
      .from('profiles')
      .select(
        'full_name, role, shift_type, employment_type, is_lead_eligible, on_fmla, fmla_return_date, is_active, archived_at, archived_by'
      )
      .eq('id', ctx!.therapist.id)
      .single()

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      full_name: updatedName,
      role: 'lead',
      shift_type: 'night',
      employment_type: 'part_time',
      is_lead_eligible: true,
      on_fmla: true,
      fmla_return_date: '2026-05-12',
      is_active: false,
      archived_by: ctx!.manager.id,
    })
    expect(result.data?.archived_at).toBeTruthy()
  })
})
