'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Menu, ChevronDown, Loader2 } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'

import { can } from '@/lib/auth/can'
import type { UiRole } from '@/lib/auth/roles'
import { TeamwiseMark } from '@/components/teamwise-logo'
import { NotificationBell } from '@/components/NotificationBell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

export type AppShellUser = {
  fullName: string
  role: UiRole
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
  { href: '/availability', label: 'Future Availability' },
  { href: '/shift-board', label: 'Shift Swaps (Published)' },
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

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <TeamwiseMark size="small" />
      <span
        className="text-[17px] font-extrabold leading-none tracking-[-0.03em] text-foreground"
        style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}
      >
        Team<span style={{ color: 'var(--attention)' }}>wise</span>
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
    return 'rounded-md bg-primary text-primary-foreground shadow-sm'
  }
  return 'rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors duration-150'
}

export function AppShell({ user, publishCta, children }: AppShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const userMenuButtonRef = useRef<HTMLButtonElement>(null)
  const firstUserMenuItemRef = useRef<HTMLAnchorElement>(null)
  const userMenuButtonId = useId()
  const userMenuId = `${userMenuButtonId}-menu`
  const canAccessManagerUi = can(user?.role, 'access_manager_ui')

  const shouldRenderShell = useMemo(() => Boolean(user) && usesAppShell(pathname), [pathname, user])
  const navItems = canAccessManagerUi ? MANAGER_NAV_ITEMS : STAFF_NAV_ITEMS
  const dashboardHref = canAccessManagerUi ? MANAGER_WORKFLOW_LINKS.dashboard : '/dashboard/staff'

  useEffect(() => {
    if (!userMenuOpen) return

    firstUserMenuItemRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setUserMenuOpen(false)
      userMenuButtonRef.current?.focus()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [userMenuOpen])

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
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="no-print sticky top-0 z-30 border-b border-border bg-card/95 shadow-[0_1px_0_rgba(6,103,169,0.06),0_2px_8px_rgba(15,23,42,0.05)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 md:px-8">
          {/* Logo */}
          <Link
            href={dashboardHref}
            className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo />
          </Link>

          {/* Desktop nav */}
          <nav className="mx-auto hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {navItems.map((item) => {
              const active = isNavItemActive(pathname, searchParams, item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn('px-3 py-1.5 text-sm font-medium', navLinkClass(active))}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Right-side actions */}
          <div className="ml-auto flex items-center gap-2">
            {canAccessManagerUi && publishCta && (
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link href={publishCta.href}>{publishCta.label}</Link>
              </Button>
            )}

            <NotificationBell />

            {/* User menu */}
            <div className="relative">
              <button
                id={userMenuButtonId}
                ref={userMenuButtonRef}
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="inline-flex min-h-[36px] items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-controls={userMenuId}
                aria-label="Open user menu"
              >
                <span
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: 'var(--attention)' }}
                  aria-hidden="true"
                >
                  {initials(user?.fullName ?? 'Team member')}
                </span>
                <span className="hidden max-w-[8rem] truncate font-medium sm:block">
                  {user?.fullName}
                </span>
                <Badge
                  variant={canAccessManagerUi ? 'default' : 'outline'}
                  className={cn(
                    'hidden capitalize sm:inline-flex',
                    canAccessManagerUi
                      ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                      : undefined
                  )}
                >
                  {user?.role}
                </Badge>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 text-muted-foreground transition-transform duration-150',
                    userMenuOpen && 'rotate-180'
                  )}
                  aria-hidden="true"
                />
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden="true"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div
                    id={userMenuId}
                    className="absolute right-0 z-20 mt-1.5 w-44 rounded-lg border border-border bg-card p-1 shadow-[0_4px_16px_rgba(15,23,42,0.12),0_1px_3px_rgba(15,23,42,0.06)]"
                    role="menu"
                    aria-labelledby={userMenuButtonId}
                  >
                    <Link
                      ref={firstUserMenuItemRef}
                      href="/profile"
                      role="menuitem"
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <div className="my-1 border-t border-border" />
                    <form action="/auth/signout" method="post" onSubmit={() => setSigningOut(true)}>
                      <button
                        type="submit"
                        role="menuitem"
                        disabled={signingOut}
                        className="inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted disabled:opacity-60"
                      >
                        {signingOut && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        )}
                        {signingOut ? 'Signing out...' : 'Sign out'}
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>

            {/* Mobile menu toggle */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="app-shell-mobile-nav"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
              <span className="ml-1">Menu</span>
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <div id="app-shell-mobile-nav" className="border-t border-border md:hidden">
            <nav
              className="mx-auto flex w-full max-w-6xl flex-col gap-0.5 px-4 py-2"
              aria-label="Mobile navigation"
            >
              {canAccessManagerUi && publishCta && (
                <Link
                  href={publishCta.href}
                  className="mb-1 flex min-h-[44px] items-center rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {publishCta.label}
                </Link>
              )}
              {navItems.map((item) => {
                const active = isNavItemActive(pathname, searchParams, item)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex min-h-[44px] items-center px-3 py-2.5 text-sm font-medium',
                      navLinkClass(active)
                    )}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8"
      >
        {children}
      </main>
    </div>
  )
}
