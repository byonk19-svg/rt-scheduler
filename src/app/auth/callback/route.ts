import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

function toSafeRedirectPath(path: string | null): string {
  if (!path) return '/dashboard'
  if (!path.startsWith('/')) return '/dashboard'
  if (path.startsWith('//')) return '/dashboard'
  return path
}

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl
  const code = requestUrl.searchParams.get('code')
  const next =
    requestUrl.searchParams.get('next') ?? requestUrl.searchParams.get('redirectTo') ?? '/dashboard'
  const redirectPath = toSafeRedirectPath(next)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(new URL('/login?error=auth_callback_failed', request.url))
    }
  }

  return NextResponse.redirect(new URL(redirectPath, request.url))
}
