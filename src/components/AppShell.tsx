'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ArrowLeftRight, CalendarDays, ChevronDown, LogOut, Menu, Settings, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { can } from '@/lib/auth/can'
import type { UiRole } from '@/lib/auth/roles'
import { NotificationBell } from '@/components/NotificationBell'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

// ─── Exported constants (kept for test compatibility) ──────────────────────
export const APP_SHELL_SIDEBAR_CLASS =
  'no-print hidden shrink-0 flex-col border-r border-sidebar-border/70 bg-sidebar text-sidebar-foreground shadow-none lg:flex lg:h-screen lg:max-h-screen lg:min-h-0 lg:self-start lg:sticky lg:top-0'
export const APP_SHELL_ACTIVE_NAV_CLASS =
  'bg-sidebar-accent/85 text-sidebar-primary shadow-tw-2xs ring-2 ring-sidebar-ring/45 ring-offset-1 ring-offset-[var(--sidebar)]'
export const APP_SHELL_PROFILE_CARD_CLASS =
  'mt-2 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/15 px-2.5 py-2'

// ─── Types ─────────────────────────────────────────────────────────────────
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

type SubNavItem = {
  href: string
  label: string
  isActive: (pathname: string, searchParams: SearchParamsState) => boolean
  showBadge?: boolean
}

type PrimarySection = {
  key: string
  label: string
  href: string
  isActive: (pathname: string, searchParams: SearchParamsState) => boolean
  subItems: SubNavItem[]
}

function isManagerScheduleRoute(pathname: string): boolean {
  return (
    pathname === '/coverage' ||
    pathname === '/schedule' ||
    pathname === '/availability' ||
    pathname === '/publish' ||
    pathname.startsWith('/publish/') ||
    pathname === '/approvals'
  )
}

// ─── Manager sections ──────────────────────────────────────────────────────
// Three top-level sections: Today (inbox), Schedule (cycle workflow),
// People (roster + requests). Sub-items appear in a secondary nav bar.
export function buildManagerSections(pendingCount: number): readonly PrimarySection[] {
  return [
    {
      key: 'today',
      label: 'Today',
      href: MANAGER_WORKFLOW_LINKS.dashboard,
      isActive: (p) => p.startsWith('/dashboard/manager'),
      subItems: [],
    },
    {
      key: 'schedule',
      label: 'Schedule',
      href: '/coverage',
      isActive: (p) => isManagerScheduleRoute(p),
      subItems: [
        {
          href: '/coverage',
          label: 'Coverage',
          // `/schedule` still redirects into the coverage workflow.
          isActive: (p) => p === '/coverage' || p === '/schedule',
        },
        {
          href: '/availability',
          label: 'Availability',
          isActive: (p) => p === '/availability',
        },
        {
          href: '/publish',
          label: 'Publish',
          isActive: (p) => p === '/publish' || p.startsWith('/publish/'),
        },
        {
          href: '/approvals',
          label: 'Approvals',
          isActive: (p) => p === '/approvals',
        },
      ],
    },
    {
      key: 'people',
      label: 'People',
      href: '/team',
      isActive: (p) =>
        p === '/team' ||
        p === '/requests' ||
        p.startsWith('/requests/') ||
        p === '/shift-board' ||
        p === '/settings' ||
        p.startsWith('/settings/'),
      subItems: [
        {
          href: '/team',
          label: 'Team',
          isActive: (p) => p === '/team',
        },
        {
          href: '/requests',
          label: 'Requests',
          isActive: (p) => p === '/requests' || p.startsWith('/requests/') || p === '/shift-board',
          showBadge: pendingCount > 0,
        },
        {
          href: '/settings/audit-log',
          label: 'Audit log',
          isActive: (p) => p === '/settings/audit-log',
        },
      ],
    },
  ]
}

// ─── Staff flat nav ────────────────────────────────────────────────────────
const STAFF_NAV_ITEMS = [
  {
    href: '/dashboard/staff',
    label: 'Dashboard',
    isActive: (p: string) => p.startsWith('/dashboard/staff'),
  },
  {
    href: '/coverage',
    label: 'Schedule',
    isActive: (p: string) => p === '/coverage' || p === '/schedule' || p === '/preliminary',
  },
  {
    href: '/staff/my-schedule',
    label: 'My Schedule',
    isActive: (p: string) => p === '/staff/my-schedule',
  },
  {
    href: '/therapist/availability',
    label: 'Availability',
    isActive: (p: string) => p === '/therapist/availability' || p === '/availability',
  },
  {
    href: '/shift-board',
    label: 'Open shifts',
    isActive: (p: string) => p === '/shift-board',
  },
  {
    href: '/staff/history',
    label: 'History',
    isActive: (p: string) => p === '/staff/history',
  },
] as const

const SHELL_ROUTES = [
  '/dashboard',
  '/schedule',
  '/coverage',
  '/availability',
  '/shift-board',
  '/staff',
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

// ─── Helpers ───────────────────────────────────────────────────────────────
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TM'
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

// ─── Logo ──────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground shadow-tw-2xs ring-1 ring-sidebar-ring/35">
        <CalendarDays className="h-4 w-4 text-[color:var(--sidebar-ring)]" aria-hidden />
      </div>
      <div className="leading-none hidden sm:block">
        <p className="font-heading text-sm font-bold tracking-[-0.02em] text-sidebar-primary">
          Teamwise
        </p>
        <p className="mt-0.5 text-[0.62rem] font-medium tracking-wide text-[color:var(--sidebar-muted)]">
          Respiratory Therapy
        </p>
      </div>
    </div>
  )
}

// ─── User dropdown ─────────────────────────────────────────────────────────
function UserDropdown({
  user,
  canAccessManagerUi,
}: {
  user: AppShellUser | null
  canAccessManagerUi: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const roleLabel =
    user?.role === 'manager' ? 'Manager' : user?.role === 'lead' ? 'Lead' : 'Staff Therapist'

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="User menu"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-sidebar-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--attention)] text-[10px] font-bold text-accent-foreground select-none">
          {initials(user?.fullName ?? 'TM')}
        </span>
        <span className="hidden md:block max-w-[120px] truncate text-xs font-semibold text-sidebar-primary">
          {user?.fullName ?? 'Team member'}
        </span>
        <ChevronDown
          className={cn(
            'h-3 w-3 text-sidebar-foreground transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-border bg-card shadow-tw-md z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-sm font-semibold text-foreground truncate">
              {user?.fullName ?? 'Team member'}
            </p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <div className="p-1">
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground no-underline transition-colors hover:bg-muted hover:no-underline"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              Settings
            </Link>
            {canAccessManagerUi && (
              <Link
                href="/therapist"
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground no-underline transition-colors hover:bg-muted hover:no-underline"
                onClick={() => setOpen(false)}
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Therapist view
              </Link>
            )}
          </div>
          <div className="border-t border-border p-1">
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <LogOut className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AppShell ──────────────────────────────────────────────────────────────
export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const canAccessManagerUi = can(user?.role, 'access_manager_ui')

  const shouldRenderShell = useMemo(() => Boolean(user) && usesAppShell(pathname), [pathname, user])

  const dashboardHref = canAccessManagerUi ? MANAGER_WORKFLOW_LINKS.dashboard : '/dashboard/staff'
  const pendingCount = user?.pendingAccessRequests ?? 0
  const managerSections = useMemo(() => buildManagerSections(pendingCount), [pendingCount])

  // Which primary section is currently active (manager only)
  const activeSection = useMemo(() => {
    if (!canAccessManagerUi) return null
    return managerSections.find((s) => s.isActive(pathname, searchParams)) ?? null
  }, [canAccessManagerUi, managerSections, pathname, searchParams])

  const hasSecondaryNav = Boolean(activeSection && activeSection.subItems.length > 0)

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [])

  if (!shouldRenderShell) {
    return <>{children}</>
  }

  const isCoveragePage = pathname === '/coverage'

  // Primary nav: 56px (h-14). Secondary nav: 44px (h-11). Total: 100px.
  const mainTopPadding = hasSecondaryNav ? 'pt-[100px]' : 'pt-14'

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-card px-3 py-2 text-sm font-medium text-foreground shadow-lg outline-none focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Skip to main content
      </a>

      {/* ── Primary top nav ─────────────────────────────────────────────── */}
      <header className="no-print print:hidden app-shell-chrome-primary fixed top-0 left-0 right-0 z-30 h-14 border-b border-sidebar-border/80 text-sidebar-foreground shadow-tw-app-chrome">
        <div className="flex h-full touch-manipulation items-center gap-2 px-3 sm:gap-3 sm:px-4">
          {/* Logo */}
          <Link
            href={dashboardHref}
            aria-label="Teamwise — go to dashboard"
            className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <Logo />
          </Link>

          {/* Primary nav items — desktop */}
          {canAccessManagerUi ? (
            <nav className="hidden md:flex items-center gap-0.5 ml-4" aria-label="Main navigation">
              {managerSections.map((section) => {
                const active = section.isActive(pathname, searchParams)
                return (
                  <Link
                    key={section.key}
                    href={section.href}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                      active
                        ? APP_SHELL_ACTIVE_NAV_CLASS
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {section.label}
                    {section.key === 'people' && pendingCount > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--attention)] px-1.5 text-[10px] font-bold text-accent-foreground">
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>
          ) : (
            <nav className="hidden md:flex items-center gap-0.5 ml-4" aria-label="Main navigation">
              {STAFF_NAV_ITEMS.map((item) => {
                const active = item.isActive(pathname)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                      active
                        ? APP_SHELL_ACTIVE_NAV_CLASS
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          )}

          {/* Right side: notification bell + user dropdown */}
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell variant="shell" />
            <UserDropdown user={user} canAccessManagerUi={canAccessManagerUi} />
          </div>

          {/* Mobile hamburger */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="md:hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* ── Secondary nav (manager — Schedule and People sections) ─────── */}
      {hasSecondaryNav && activeSection && (
        <nav
          className="no-print print:hidden app-shell-chrome-secondary fixed top-14 left-0 right-0 z-20 h-11 border-b border-sidebar-border/60 shadow-tw-app-chrome-sub"
          aria-label="Section navigation"
        >
          <div className="h-full overflow-x-auto">
            <div className="flex h-full min-w-max items-center gap-0.5 px-5">
              {activeSection.subItems.map((item) => {
                const active = item.isActive(pathname, searchParams)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative flex h-full shrink-0 items-center gap-1.5 px-3 text-[13px] font-medium transition-colors duration-150',
                      active
                        ? 'text-sidebar-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t-full after:bg-[color:var(--sidebar-ring)]'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/30 hover:text-sidebar-accent-foreground'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                    {item.showBadge && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--attention)] px-1.5 text-[10px] font-bold text-accent-foreground">
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className={cn('min-h-screen', mainTopPadding)}>
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            'w-full print:max-w-none',
            isCoveragePage
              ? ''
              : 'mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7 print:mx-0 print:px-4 print:py-4'
          )}
        >
          {children}
        </main>
      </div>

      {/* ── Mobile menu overlay ─────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
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
            className="app-shell-chrome-primary relative z-10 flex h-full w-[85vw] max-w-[20rem] flex-col overscroll-contain border-r border-sidebar-border text-sidebar-foreground shadow-tw-app-chrome-sub"
          >
            <h2 id="mobile-nav-heading" className="sr-only">
              Navigation menu
            </h2>
            <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
              <Logo />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
              {canAccessManagerUi ? (
                <>
                  {managerSections.map((section) =>
                    section.subItems.length > 0 ? (
                      <div key={section.key}>
                        <p className="px-2 pb-1 pt-3 text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--sidebar-muted)]">
                          {section.label}
                        </p>
                        {section.subItems.map((item) => {
                          const active = item.isActive(pathname, searchParams)
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                'flex min-h-[42px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                                active
                                  ? APP_SHELL_ACTIVE_NAV_CLASS
                                  : 'text-sidebar-foreground hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground transition-colors duration-150'
                              )}
                              aria-current={active ? 'page' : undefined}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              <span>{item.label}</span>
                              {item.showBadge && (
                                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--attention)] px-1.5 text-[10px] font-bold text-accent-foreground">
                                  {pendingCount}
                                </span>
                              )}
                            </Link>
                          )
                        })}
                      </div>
                    ) : (
                      <Link
                        key={section.key}
                        href={section.href}
                        className={cn(
                          'flex min-h-[42px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                          section.isActive(pathname, searchParams)
                            ? APP_SHELL_ACTIVE_NAV_CLASS
                            : 'text-sidebar-foreground hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground transition-colors duration-150'
                        )}
                        aria-current={section.isActive(pathname, searchParams) ? 'page' : undefined}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {section.label}
                      </Link>
                    )
                  )}
                </>
              ) : (
                <>
                  <p className="px-2 pb-2 pt-3 text-[10px] font-medium tracking-[0.08em] text-[color:var(--sidebar-muted)]">
                    MY SHIFTS
                  </p>
                  {STAFF_NAV_ITEMS.map((item) => {
                    const active = item.isActive(pathname)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex min-h-[42px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                          active
                            ? APP_SHELL_ACTIVE_NAV_CLASS
                            : 'text-sidebar-foreground hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground transition-colors duration-150'
                        )}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </>
              )}
            </nav>

            <div className="mt-auto shrink-0 space-y-1 border-t border-sidebar-border bg-sidebar px-3 py-3">
              <div className={APP_SHELL_PROFILE_CARD_CLASS}>
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-[1.625rem] w-[1.625rem] shrink-0 items-center justify-center rounded-full bg-[color:var(--attention)] text-[10px] font-bold text-accent-foreground">
                    {initials(user?.fullName ?? 'Team member')}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-sidebar-primary">
                      {user?.fullName ?? 'Team member'}
                    </p>
                    <p className="mt-0.5 text-[10px] capitalize text-[color:var(--sidebar-muted)]">
                      {user?.role === 'manager'
                        ? 'Manager'
                        : user?.role === 'lead'
                          ? 'Lead'
                          : 'Staff Therapist'}
                    </p>
                  </div>
                </div>
              </div>
              {canAccessManagerUi && (
                <Link
                  href="/therapist"
                  className="flex min-h-[38px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-[color:var(--sidebar-muted)] transition-colors hover:text-sidebar-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                  Switch to Therapist view
                </Link>
              )}
              <Link
                href="/settings"
                className="flex min-h-[38px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/45"
                onClick={() => setMobileMenuOpen(false)}
              >
                Settings
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex min-h-[38px] w-full items-center rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
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
