import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { isValidPublishWorkerRequest } from '@/lib/security/worker-auth'

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/auth/callback', '/auth/signout'] as const

// Manager-only paths. Do not include shared staff surfaces (schedule, shift board, /requests alias)
// or therapists/leads will be bounced by the guard below.
const MANAGER_ROUTES = [
  '/dashboard/manager',
  '/directory',
  '/team',
  '/approvals',
  '/publish',
] as const

const STAFF_ROUTES = ['/staff', '/dashboard/staff', '/requests/new'] as const

type AppRole = 'manager' | 'staff'
type ProfileAccessRow = {
  role: string | null
  is_active: boolean | null
  archived_at: string | null
}

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (route === '/') return pathname === '/'
    return matchesRoute(pathname, route)
  })
}

function normalizeRole(value: unknown): AppRole | null {
  const role = parseRole(value)
  if (!role) return null
  if (role === 'manager') return 'manager'
  if (role === 'therapist' || role === 'lead') return 'staff'
  return null
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const pathWithQuery = `${pathname}${request.nextUrl.search}`

  // Allow key-authenticated publish worker calls to bypass session auth middleware.
  if (matchesRoute(pathname, '/api/publish/process')) {
    if (await isValidPublishWorkerRequest(request)) {
      return NextResponse.next({
        request,
      })
    }
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next({
      request,
    })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    user = authUser
  } catch (error) {
    console.warn(
      'Supabase auth check failed in proxy middleware:',
      error instanceof Error ? error.message : error
    )
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathWithQuery)
    return NextResponse.redirect(url)
  }

  // If not logged in and trying to access a protected page, redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathWithQuery)
    return NextResponse.redirect(url)
  }

  const claimRole = user.app_metadata?.user_role ?? user.user_metadata?.user_role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.warn('Profile lookup failed in proxy middleware:', profileError.message || profileError)
  }

  const profileRow = (profile as ProfileAccessRow | null) ?? null
  if (profileRow && (profileRow.is_active === false || profileRow.archived_at)) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/signout'
    url.searchParams.set('next', '/?error=account_inactive')
    return NextResponse.redirect(url)
  }

  const role = normalizeRole(profileRow?.role ?? claimRole)

  if (!role) {
    if (!matchesRoute(pathname, '/pending-setup')) {
      return NextResponse.redirect(new URL('/pending-setup', request.url))
    }
    return supabaseResponse
  }

  if (matchesRoute(pathname, '/pending-setup')) {
    return NextResponse.redirect(
      new URL(can(role, 'access_manager_ui') ? '/dashboard' : '/dashboard/staff', request.url)
    )
  }

  if (role === 'staff' && pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/dashboard/staff', request.url))
  }

  if (
    !can(role, 'access_manager_ui') &&
    MANAGER_ROUTES.some((route) => matchesRoute(pathname, route))
  ) {
    return NextResponse.redirect(new URL('/dashboard/staff', request.url))
  }

  if (
    can(role, 'access_manager_ui') &&
    STAFF_ROUTES.some((route) => matchesRoute(pathname, route))
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
