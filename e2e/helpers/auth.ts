import { createServerClient } from '@supabase/ssr'
import { expect, type Page } from '@playwright/test'

import { getEnv } from './env'

export async function loginAs(page: Page, email: string, password: string) {
  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for e2e auth.'
    )
  }

  const cookieJar = new Map<string, { value: string; options: Record<string, unknown> }>()
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return [...cookieJar.entries()].map(([name, row]) => ({ name, value: row.value }))
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          if (cookie.value) {
            cookieJar.set(cookie.name, { value: cookie.value, options: cookie.options ?? {} })
          } else {
            cookieJar.delete(cookie.name)
          }
        }
      },
    },
  })

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(`Could not sign in ${email}: ${error.message}`)
  }

  await page.context().addCookies(
    [...cookieJar.entries()].map(([name, row]) => ({
      name,
      value: row.value,
      domain: '127.0.0.1',
      path: typeof row.options.path === 'string' ? row.options.path : '/',
      httpOnly: Boolean(row.options.httpOnly),
      secure: Boolean(row.options.secure),
      sameSite: 'Lax' as const,
    }))
  )

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/dashboard(?:\/(?:manager|staff))?(?:[/?].*)?$/, {
    timeout: 30_000,
  })
}
