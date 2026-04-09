'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  ArrowLeftRight,
  Bell,
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  Menu,
  Send,
  Users,
  Settings,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'

import { can } from '@/lib/auth/can'
import type { UiRole } from '@/lib/auth/roles'
import { NotificationBell } from '@/components/NotificationBell'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

export type AppShellUser = {
  fullName: string
  role: UiRole
  pendingAccessRequests?: number
}

type AppShellProps = {
  user: AppShellUser | null
  children: ReactNode
}

type SearchParamsState = ReturnType<typeof useSearchParams>

type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  isActive?: (pathname: string, searchParams: SearchParamsState) => boolean
}

const STAFF_NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard/staff', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/coverage?view=week',
    label: 'Schedule',
    icon: CalendarDays,
    isActive: (pathname) => pathname === '/coverage',
  },
  {
    href: '/preliminary',
    label: 'Schedule preview',
    icon: CalendarRange,
    isActive: (pathname) => pathname === '/preliminary',
  },
  { href: '/therapist/availability', label: 'Availability', icon: CalendarRange },
  { href: '/shift-board', label: 'Open shifts', icon: ArrowLeftRight },
  { href: '/notifications', label: 'Notifications', icon: Bell },
]

const MANAGER_NAV_ITEMS: readonly NavItem[] = [
  { href: MANAGER_WORKFLOW_LINKS.dashboard, label: 'Inbox', icon: LayoutDashboard },
  {
    href: MANAGER_WORKFLOW_LINKS.coverage,
    label: 'Schedule',
    icon: CalendarDays,
    isActive: (pathname, searchParams) =>
      pathname === '/coverage' ||
      (pathname === '/schedule' && ['calendar', 'week'].includes(searchParams.get('view') ?? '')),
  },
  { href: '/availability', label: 'Availability', icon: CalendarRange },
  {
    href: '/requests',
    label: 'Requests',
    icon: ArrowLeftRight,
    isActive: (pathname) =>
      pathname === '/requests' || pathname.startsWith('/requests/') || pathname === '/shift-board',
  },
  {
    href: '/requests/user-access',
    label: 'User Access Requests',
    icon: Users,
    isActive: (pathname) => pathname === '/requests/user-access',
  },
  {
    href: '/team',
    label: 'Team',
    icon: Users,
    isActive: (pathname) => pathname === '/team',
  },
  {
    href: '/approvals',
    label: 'Approvals',
    icon: Bell,
    isActive: (pathname) => pathname === '/approvals',
  },
  {
    href: '/publish',
    label: 'Publish History',
    icon: Send,
    isActive: (pathname) => pathname === '/publish' || pathname.startsWith('/publish/'),
  },
]

const MANAGER_BOTTOM_NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    isActive: (pathname) => pathname === '/settings' || pathname === '/profile',
  },
]

const STAFF_BOTTOM_NAV_ITEMS: readonly NavItem[] = [
  { href: '/profile', label: 'Profile', icon: Settings },
]

const SHELL_ROUTES = [
  '/dashboard',
  '/schedule',
  '/coverage',
  '/availability',
  '/shift-board',
  '/publish',
  '/profile',
  '/approvals',
  '/preliminary',
  '/requests',
  '/notifications',
  '/swaps',
  '/team',
  '/settings',
  '/therapist',
] as const

export const APP_SHELL_SIDEBAR_CLASS =
  'no-print hidden shrink-0 flex-col border-r border-precision-grid-line bg-card text-foreground shadow-none lg:flex lg:h-screen lg:max-h-screen lg:min-h-0 lg:self-start lg:sticky lg:top-0'

export const APP_SHELL_ACTIVE_NAV_CLASS =
  'border-l-4 border-precision-emerald bg-precision-slate-base text-precision-teal-dark'

export const APP_SHELL_PROFILE_CARD_CLASS =
  'mt-2 rounded-md border border-precision-grid-line bg-precision-slate-base px-2.5 py-2'

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded border border-precision-grid-line bg-card">
        <CalendarDays className="h-4 w-4 text-precision-teal-dark" />
      </div>
      <div className="leading-none">
        <p className="font-heading text-sm font-bold tracking-[-0.02em] text-foreground">
          Teamwise
        </p>
        <p className="mt-0.5 text-[0.66rem] font-medium tracking-wide text-muted-foreground">
          Respiratory Therapy
        </p>
      </div>
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

function isNavItemActive(
  pathname: string,
  searchParams: SearchParamsState,
  navItem: NavItem
): boolean {
  if (navItem.isActive) {
    return navItem.isActive(pathname, searchParams)
  }
  return isRouteActive(pathname, navItem.href)
}

function navLinkClass(isActive: boolean): string {
  if (isActive) {
    return APP_SHELL_ACTIVE_NAV_CLASS
  }
  return 'border-l-4 border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors duration-150'
}

function shouldShowPendingBadge(user: AppShellUser | null, href: string): boolean {
  if (!user || user.role !== 'manager') return false
  if (!user.pendingAccessRequests || user.pendingAccessRequests <= 0) return false
  return href === '/requests' || href === '/requests/user-access'
}

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const canAccessManagerUi = can(user?.role, 'access_manager_ui')

  const shouldRenderShell = useMemo(() => Boolean(user) && usesAppShell(pathname), [pathname, user])
  const navItems = useMemo(() => {
    if (canAccessManagerUi) return MANAGER_NAV_ITEMS
    return STAFF_NAV_ITEMS
  }, [canAccessManagerUi])
  const bottomNavItems = canAccessManagerUi ? MANAGER_BOTTOM_NAV_ITEMS : STAFF_BOTTOM_NAV_ITEMS
  const dashboardHref = canAccessManagerUi ? MANAGER_WORKFLOW_LINKS.dashboard : '/dashboard/staff'
  const roleLabel = canAccessManagerUi ? 'WORKSPACE' : 'PORTAL'
  const staffSwitchLink = useMemo(() => {
    if (canAccessManagerUi) return { href: '/therapist', label: 'Switch to Therapist view' }
    return null
  }, [canAccessManagerUi])
  const isCoveragePage = pathname === '/coverage'

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  if (!shouldRenderShell) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-card px-3 py-2 text-sm font-medium text-foreground shadow-lg outline-none focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Skip to main content
      </a>

      <div className="flex min-h-screen items-start">
        <aside className={cn(APP_SHELL_SIDEBAR_CLASS, 'w-64 max-w-[256px]')}>
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-4">
            <Link
              href={dashboardHref}
              aria-label="Teamwise Respiratory Therapy"
              className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Logo />
            </Link>
            <NotificationBell variant="shell" />
          </div>

          <nav
            className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-y-contain px-3 py-3"
            aria-label="Main navigation"
          >
            <p className="px-2 pb-2 pt-3 text-[10px] font-medium tracking-[0.08em] text-muted-foreground">
              {roleLabel}
            </p>
            {navItems.map((item) => {
              const active = isNavItemActive(pathname, searchParams, item)
              const Icon = item.icon
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-r-md px-2.5 py-2 text-[13px] font-medium',
                    navLinkClass(active)
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                  {shouldShowPendingBadge(user, item.href) && (
                    <span className="ml-auto rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning-text)]">
                      {user?.pendingAccessRequests}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="mt-auto shrink-0 space-y-1 border-t border-precision-grid-line bg-card px-3 py-3">
            {bottomNavItems.map((item) => {
              const active = isNavItemActive(pathname, searchParams, item)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-r-md px-2.5 py-2 text-[13px] font-medium',
                    navLinkClass(active)
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              )
            })}

            {staffSwitchLink ? (
              <Link
                href={staffSwitchLink.href}
                className="flex min-h-[36px] items-center gap-2.5 rounded-md px-2.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                {staffSwitchLink.label}
              </Link>
            ) : null}

            <div className={APP_SHELL_PROFILE_CARD_CLASS}>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-[1.625rem] w-[1.625rem] shrink-0 items-center justify-center rounded-full bg-precision-emerald-muted text-[11px] font-bold text-precision-teal-dark">
                  {initials(user?.fullName ?? 'Team member')}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {user?.fullName ?? 'Team member'}
                  </p>
                  <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                    {user?.role === 'manager'
                      ? 'Manager'
                      : user?.role === 'lead'
                        ? 'Lead'
                        : 'Staff Therapist'}
                  </p>
                </div>
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="ml-2 mt-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Log out
              </button>
            </form>
          </div>
        </aside>

        <div className="relative flex min-h-screen min-w-0 flex-1 flex-col">
          <div
            className="pointer-events-none absolute inset-0 precision-content-grid"
            aria-hidden
          />
          <header className="no-print relative z-10 sticky top-0 border-b border-precision-grid-line bg-card px-3 py-2 text-foreground shadow-none lg:hidden">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-expanded={mobileMenuOpen}
                aria-controls="app-shell-mobile-nav"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                <span className="ml-1">Menu</span>
              </Button>

              <Link
                href={dashboardHref}
                aria-label="Teamwise Respiratory Therapy"
                className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Logo />
              </Link>

              <div className="flex items-center gap-1.5">
                <NotificationBell variant="shell" />
                <form action="/auth/signout" method="post">
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    className="text-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Log out"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              'relative z-10 w-full',
              isCoveragePage ? 'px-0 py-0' : 'mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7'
            )}
          >
            {children}
          </main>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          aria-modal="true"
          role="dialog"
          aria-labelledby="mobile-nav-heading"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          />
          <aside
            id="app-shell-mobile-nav"
            className="relative z-10 flex h-full w-[85vw] max-w-[20rem] flex-col overscroll-contain border-r border-precision-grid-line bg-card text-foreground"
          >
            <h2 id="mobile-nav-heading" className="sr-only">
              Navigation menu
            </h2>
            <div className="flex items-center justify-between border-b border-precision-grid-line px-4 py-4">
              <Logo />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <nav
              className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-y-contain px-3 py-3"
              aria-label="Mobile navigation"
            >
              <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {roleLabel}
              </p>
              {navItems.map((item) => {
                const active = isNavItemActive(pathname, searchParams, item)
                const Icon = item.icon
                return (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    className={cn(
                      'flex min-h-[42px] items-center gap-2.5 rounded-r-md px-2.5 py-2 text-sm font-medium',
                      navLinkClass(active)
                    )}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{item.label}</span>
                    {shouldShowPendingBadge(user, item.href) && (
                      <span className="ml-auto rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning-text)]">
                        {user?.pendingAccessRequests}
                      </span>
                    )}
                  </Link>
                )
              })}
              {staffSwitchLink ? (
                <Link
                  href={staffSwitchLink.href}
                  className="flex min-h-[38px] items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  {staffSwitchLink.label}
                </Link>
              ) : null}
            </nav>

            <div className="mt-auto shrink-0 space-y-1 border-t border-precision-grid-line bg-card px-3 py-3">
              {bottomNavItems.map((item) => {
                const active = isNavItemActive(pathname, searchParams, item)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex min-h-[38px] items-center gap-2.5 rounded-r-md px-2.5 py-2 text-sm font-medium',
                      navLinkClass(active)
                    )}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                )
              })}

              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex min-h-[38px] w-full items-center rounded-md px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Log out
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
