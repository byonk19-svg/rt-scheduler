import { expect, test, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

type TestContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
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

async function createManager(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<{ id: string }> {
  const createResult = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'E2E Directory Redirect Manager' },
  })

  if (createResult.error || !createResult.data.user) {
    throw new Error(
      `Could not create redirect test manager ${email}: ${createResult.error?.message ?? 'unknown error'}`
    )
  }

  const userId = createResult.data.user.id
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      full_name: 'E2E Directory Redirect Manager',
      email,
      role: 'manager',
      shift_type: 'day',
      employment_type: 'full_time',
      max_work_days_per_week: 3,
      preferred_work_days: [],
      is_lead_eligible: true,
      on_fmla: false,
      is_active: true,
      site_id: 'default',
    },
    { onConflict: 'id' }
  )

  if (profileError) {
    throw new Error(`Could not upsert manager profile for ${email}: ${profileError.message}`)
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

test.describe.serial('/directory redirect behavior', () => {
  test.setTimeout(60_000)
  let ctx: TestContext | null = null

  test.beforeAll(async () => {
    const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const managerEmail = `${randomString('dir-redir-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 8)}`
    const manager = await createManager(supabase, managerEmail, managerPassword)

    ctx = {
      supabase,
      manager: {
        id: manager.id,
        email: managerEmail,
        password: managerPassword,
      },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return
    await ctx.supabase.auth.admin.deleteUser(ctx.manager.id)
  })

  test('unauthenticated /directory request lands on /login', async ({ page }) => {
    await page.goto('/directory')
    await expect(page).toHaveURL(/\/login(?:[/?].*)?$/)
  })

  test('authenticated manager /directory request lands on /team', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await login(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/directory', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/team(?:[/?].*)?$/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Managers' })).toBeVisible()
  })
})
