'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Menu, ChevronDown } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { TeamwiseLogo } from '@/components/teamwise-logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

export type AppShellUser = {
  fullName: string
  role: 'manager' | 'therapist'
}

type AppShellProps = {
  user: AppShellUser | null
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
  { href: '/schedule?view=grid', label: 'Schedule' },
  { href: '/availability', label: 'Requests' },
  { href: '/shift-board', label: 'Shift Board' },
]

const MANAGER_NAV_ITEMS: readonly NavItem[] = [
  { href: MANAGER_WORKFLOW_LINKS.dashboard, label: 'Dashboard' },
  {
    href: MANAGER_WORKFLOW_LINKS.approvals,
    label: 'Approvals',
    isActive: (pathname) => pathname === '/shift-board' || pathname === '/availability',
  },
  {
    href: MANAGER_WORKFLOW_LINKS.coverage,
    label: 'Coverage gaps',
    isActive: (pathname, searchParams) => pathname === '/schedule' && searchParams.get('view') === 'calendar',
  },
  {
    href: MANAGER_WORKFLOW_LINKS.publish,
    label: 'Publish',
    isActive: (pathname, searchParams) => pathname === '/schedule' && searchParams.get('view') !== 'calendar',
  },
]

const SHELL_ROUTES = ['/dashboard', '/schedule', '/availability', '/shift-board', '/profile'] as const

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
    return 'rounded-md bg-primary text-primary-foreground'
  }
  return 'rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground'
}

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const shouldRenderShell = useMemo(() => Boolean(user) && usesAppShell(pathname), [pathname, user])
  const navItems = user?.role === 'manager' ? MANAGER_NAV_ITEMS : STAFF_NAV_ITEMS
  const dashboardHref = user?.role === 'manager' ? MANAGER_WORKFLOW_LINKS.dashboard : '/dashboard/staff'

  if (!shouldRenderShell) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
          <Link href={dashboardHref} className="shrink-0">
            <TeamwiseLogo size="small" />
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-label="Open user menu"
              >
                <span className="max-w-[9rem] truncate font-medium">{user?.fullName}</span>
                <Badge variant="outline" className="hidden capitalize sm:inline-flex">
                  {user?.role}
                </Badge>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-md border border-border bg-white p-1 shadow-lg">
                  <Link href="/profile" className="block rounded-sm px-3 py-2 text-sm hover:bg-secondary">
                    Profile
                  </Link>
                  <form action="/auth/signout" method="post">
                    <button
                      type="submit"
                      className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      Sign out
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
