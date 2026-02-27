'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Menu, ChevronDown, Loader2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { NotificationBell } from '@/components/NotificationBell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

export type AppShellUser = {
  fullName: string
  role: 'manager' | 'therapist'
}

export type AppShellPublishCta = {
  href: string
  label: string
}

type AppShellProps = {
  user: AppShellUser | null
  publishCta?: AppShellPublishCta | null
  children: ReactNode
}

type SearchParamsState = ReturnType<typeof useSearchParams>

type NavItem = {
  href: string
  label: string
  isActive?: (pathname: string, searchParams: SearchParamsState) => boolean
}

const STAFF_NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard/staff', label: 'Dashboard' },
  { href: '/schedule?view=week', label: 'My Schedule' },
  { href: '/availability', label: 'Requests' },
  { href: '/shift-board', label: 'Shift Board' },
]

const MANAGER_NAV_ITEMS: readonly NavItem[] = [
  { href: MANAGER_WORKFLOW_LINKS.dashboard, label: 'Dashboard' },
  {
    href: MANAGER_WORKFLOW_LINKS.coverage,
    label: 'Coverage',
    isActive: (pathname, searchParams) =>
      pathname === '/coverage' ||
      (pathname === '/schedule' && ['calendar', 'week'].includes(searchParams.get('view') ?? '')),
  },
  { href: MANAGER_WORKFLOW_LINKS.team, label: 'Team' },
  {
    href: MANAGER_WORKFLOW_LINKS.approvals,
    label: 'Requests',
    isActive: (pathname) => pathname === '/shift-board' || pathname === '/availability',
  },
]

const SHELL_ROUTES = [
  '/dashboard',
  '/schedule',
  '/coverage',
  '/availability',
  '/shift-board',
  '/publish',
  '/profile',
  '/directory',
] as const
const NAV_AMBER = '#d97706'
const NAV_MANAGER_BADGE_CLASS = 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]'

function Icon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="6" fill="#1c1917" />
      <circle cx="9" cy="10" r="3" fill="#fbbf24" />
      <path d="M4 23 Q4 17 9 17 Q14 17 14 23" fill="#fbbf24" />
      <circle cx="20" cy="10" r="3" fill="#f59e0b" />
      <path d="M15 23 Q15 17 20 17 Q25 17 25 23" fill="#f59e0b" />
    </svg>
  )
}

function Logo({ size = 30, fontSize = 17, dark = false }: { size?: number; fontSize?: number; dark?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.3) }}>
      <Icon size={size} />
      <span
        style={{
          fontSize,
          fontWeight: 800,
          fontFamily: 'var(--font-plus-jakarta), sans-serif',
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: dark ? '#fafaf9' : '#1c1917',
        }}
      >
        Team<span style={{ color: NAV_AMBER }}>wise</span>
      </span>
    </div>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TM'
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function routeFromHref(href: string): string {
  return href.split('#')[0]?.split('?')[0] ?? href
}

function isRouteActive(pathname: string, href: string): boolean {
  const route = routeFromHref(href)
  return pathname === route || pathname.startsWith(`${route}/`)
}

function usesAppShell(pathname: string): boolean {
  return SHELL_ROUTES.some((route) => isRouteActive(pathname, route))
}

function isNavItemActive(pathname: string, searchParams: SearchParamsState, navItem: NavItem): boolean {
  if (navItem.isActive) {
    return navItem.isActive(pathname, searchParams)
  }
  return isRouteActive(pathname, navItem.href)
}

function navLinkClass(isActive: boolean): string {
  if (isActive) {
    return 'rounded-md bg-[#d97706] text-white'
  }
  return 'rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground'
}

export function AppShell({ user, publishCta, children }: AppShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const shouldRenderShell = useMemo(() => Boolean(user) && usesAppShell(pathname), [pathname, user])
  const navItems = user?.role === 'manager' ? MANAGER_NAV_ITEMS : STAFF_NAV_ITEMS
  const dashboardHref = user?.role === 'manager' ? MANAGER_WORKFLOW_LINKS.dashboard : '/dashboard/staff'

  if (!shouldRenderShell) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
          <Link href={dashboardHref} className="shrink-0">
            <Logo size={30} fontSize={17} />
          </Link>

          <nav className="mx-auto hidden items-center gap-2 md:flex">
            {navItems.map((item) => {
              const active = isNavItemActive(pathname, searchParams, item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${navLinkClass(active)}`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user?.role === 'manager' && publishCta && (
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link href={publishCta.href}>{publishCta.label}</Link>
              </Button>
            )}
            <NotificationBell />

            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-label="Open user menu"
              >
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: NAV_AMBER }}
                  aria-hidden="true"
                >
                  {initials(user?.fullName ?? 'Team member')}
                </span>
                <span className="max-w-[9rem] truncate font-medium">{user?.fullName}</span>
                <Badge
                  variant={user?.role === 'manager' ? 'default' : 'outline'}
                  className={cn(
                    'hidden capitalize sm:inline-flex',
                    user?.role === 'manager' ? NAV_MANAGER_BADGE_CLASS : undefined
                  )}
                >
                  {user?.role}
                </Badge>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-md border border-border bg-white p-1 shadow-lg">
                  <Link href="/profile" className="block rounded-sm px-3 py-2 text-sm hover:bg-secondary">
                    Profile
                  </Link>
                  <form action="/auth/signout" method="post" onSubmit={() => setSigningOut(true)}>
                    <button
                      type="submit"
                      disabled={signingOut}
                      className="inline-flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary disabled:opacity-60"
                    >
                      {signingOut && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                      {signingOut ? 'Signing out...' : 'Sign out'}
                    </button>
                  </form>
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="app-shell-mobile-nav"
            >
              <Menu className="h-4 w-4" />
              Menu
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div id="app-shell-mobile-nav" className="border-t border-border md:hidden">
            <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3">
              {user?.role === 'manager' && publishCta && (
                <Link href={publishCta.href} className="mb-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                  {publishCta.label}
                </Link>
              )}
              {navItems.map((item) => {
                const active = isNavItemActive(pathname, searchParams, item)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${navLinkClass(active)}`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  )
}
