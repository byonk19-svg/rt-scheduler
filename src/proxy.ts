import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/auth/callback', '/auth/signout'] as const

const MANAGER_ROUTES = [
  '/dashboard/manager',
  '/coverage',
  '/directory',
  '/team',
  '/approvals',
  '/requests',
  '/shift-board',
  '/publish',
] as const

const STAFF_ROUTES = ['/staff', '/dashboard/staff', '/requests/new'] as const

type AppRole = 'manager' | 'staff'
type ProfileRoleRow = { role: string | null }

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
  if (role === 'staff' || role === 'therapist' || role === 'lead') return 'staff'
  return null
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const pathWithQuery = `${pathname}${request.nextUrl.search}`

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
  let role = normalizeRole(claimRole)

  if (!role) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.warn(
        'Role fallback lookup failed in proxy middleware:',
        profileError.message || profileError
      )
    } else {
      role = normalizeRole((profile as ProfileRoleRow | null)?.role)
    }
  }

  if (!role) {
    if (!matchesRoute(pathname, '/pending-setup')) {
      return NextResponse.redirect(new URL('/pending-setup', request.url))
    }
    return supabaseResponse
  }

  if (matchesRoute(pathname, '/pending-setup')) {
    return NextResponse.redirect(
      new URL(can(role, 'access_manager_ui') ? '/dashboard' : '/staff/dashboard', request.url)
    )
  }

  if (role === 'staff' && pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/staff/dashboard', request.url))
  }

  if (
    !can(role, 'access_manager_ui') &&
    MANAGER_ROUTES.some((route) => matchesRoute(pathname, route))
  ) {
    return NextResponse.redirect(new URL('/staff/dashboard', request.url))
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
