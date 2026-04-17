'use client'

import ThemeProvider from '@/components/ThemeProvider'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeftRight, CalendarDays, ChevronDown, LogOut, Menu, Settings, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { DeferredNotificationBell } from '@/components/DeferredNotificationBell'
import { AppHeader } from '@/components/shell/AppHeader'
import { LocalSectionNav } from '@/components/shell/LocalSectionNav'
import {
  APP_PAGE_MAX_WIDTH_CLASS,
  buildManagerSections,
  getShellContext,
  usesAppShell,
} from '@/components/shell/app-shell-config'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import type { UiRole } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

export const APP_SHELL_SIDEBAR_CLASS =
  'no-print hidden shrink-0 flex-col border-r border-sidebar-border/70 bg-sidebar text-sidebar-foreground shadow-none lg:flex lg:h-screen lg:max-h-screen lg:min-h-0 lg:self-start lg:sticky lg:top-0'
export const APP_SHELL_ACTIVE_NAV_CLASS =
  'bg-sidebar-accent/85 text-sidebar-primary shadow-tw-2xs ring-2 ring-sidebar-ring/45 ring-offset-1 ring-offset-[var(--sidebar)]'
export const APP_SHELL_PROFILE_CARD_CLASS =
  'mt-2 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/15 px-2.5 py-2'

export type AppShellUser = {
  fullName: string
  role: UiRole
  pendingAccessRequests?: number
}

type AppShellProps = {
  user: AppShellUser | null
  unreadNotificationCount?: number
  children: ReactNode
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TM'
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground shadow-tw-2xs ring-1 ring-sidebar-ring/35">
        <CalendarDays className="h-4 w-4 text-[color:var(--sidebar-ring)]" aria-hidden />
      </div>
      <div className="hidden leading-none sm:block">
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
    function handleOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="User menu"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-sidebar-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--attention)] text-[10px] font-bold text-accent-foreground select-none">
          {initials(user?.fullName ?? 'TM')}
        </span>
        <span className="hidden max-w-[120px] truncate text-xs font-semibold text-sidebar-primary md:block">
          {user?.fullName ?? 'Team member'}
        </span>
        <ChevronDown
          className={cn(
            'h-3 w-3 text-sidebar-foreground transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-tw-md">
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-foreground">
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
            {canAccessManagerUi ? (
              <Link
                href="/therapist"
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground no-underline transition-colors hover:bg-muted hover:no-underline"
                onClick={() => setOpen(false)}
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Therapist view
              </Link>
            ) : null}
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
      ) : null}
    </div>
  )
}

export default function AppShell({ user, unreadNotificationCount = 0, children }: AppShellProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const canAccessManagerUi = can(user?.role, 'access_manager_ui')

  const shouldRenderShell = useMemo(() => Boolean(user) && usesAppShell(pathname), [pathname, user])

  const dashboardHref = canAccessManagerUi ? MANAGER_WORKFLOW_LINKS.dashboard : '/dashboard/staff'
  const pendingCount = user?.pendingAccessRequests ?? 0
  const managerSections = useMemo(() => buildManagerSections(pendingCount), [pendingCount])
  const shellContext = useMemo(
    () => getShellContext({ pathname, canAccessManagerUi, pendingCount }),
    [pathname, canAccessManagerUi, pendingCount]
  )

  const primaryItems = useMemo(
    () =>
      shellContext.primaryItems.map((item) => ({
        href: item.href,
        label: item.label,
        current: item.active(pathname),
        badgeCount: item.badgeCount,
      })),
    [pathname, shellContext.primaryItems]
  )

  const localNavItems = useMemo(
    () =>
      shellContext.localNav?.items.map((item) => ({
        href: item.href,
        label: item.label,
        current: item.active(pathname),
        badgeCount: item.badgeCount,
      })) ?? [],
    [pathname, shellContext.localNav]
  )

  useEffect(() => {
    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [])

  if (!shouldRenderShell) {
    return <>{children}</>
  }

  const isCoveragePage = pathname === '/coverage'

  return (
    <ThemeProvider>
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-card px-3 py-2 text-sm font-medium text-foreground shadow-lg outline-none focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Skip to main content
      </a>

      <AppHeader
        brand={
          <Link
            href={dashboardHref}
            aria-label="Teamwise - go to dashboard"
            className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <Logo />
          </Link>
        }
        primaryNav={
          <nav className="ml-2 hidden items-center gap-0.5 md:flex" aria-label="Main navigation">
            {primaryItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                  item.current
                    ? APP_SHELL_ACTIVE_NAV_CLASS
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground'
                )}
                aria-current={item.current ? 'page' : undefined}
              >
                {item.label}
                {item.badgeCount ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--attention)] px-1.5 text-[10px] font-bold text-accent-foreground">
                    {item.badgeCount}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        }
        utilityActions={
          <>
            <DeferredNotificationBell
              variant="shell"
              initialUnreadCount={unreadNotificationCount}
            />
            <UserDropdown user={user} canAccessManagerUi={canAccessManagerUi} />
          </>
        }
        mobileToggle={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        }
      />

      <div className="min-h-screen pt-14">
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            'w-full print:max-w-none',
            isCoveragePage
              ? 'py-5 md:py-7'
              : cn(APP_PAGE_MAX_WIDTH_CLASS, 'py-5 md:py-7 print:mx-0 print:px-4 print:py-4')
          )}
        >
          {shellContext.localNav ? (
            <div
              className={cn(
                isCoveragePage ? APP_PAGE_MAX_WIDTH_CLASS : '',
                'mb-4 border-b border-border/60 pb-3'
              )}
            >
              <LocalSectionNav ariaLabel={shellContext.localNav.ariaLabel} items={localNavItems} />
            </div>
          ) : null}
          {children}
        </main>
      </div>

      {mobileMenuOpen ? (
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
                size="icon"
                className="min-h-11 min-w-11 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
                          const active = item.active(pathname)
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                'flex min-h-[42px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                                active
                                  ? APP_SHELL_ACTIVE_NAV_CLASS
                                  : 'text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground'
                              )}
                              aria-current={active ? 'page' : undefined}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              <span>{item.label}</span>
                              {item.badgeCount ? (
                                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--attention)] px-1.5 text-[10px] font-bold text-accent-foreground">
                                  {item.badgeCount}
                                </span>
                              ) : null}
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
                          section.isActive(pathname)
                            ? APP_SHELL_ACTIVE_NAV_CLASS
                            : 'text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground'
                        )}
                        aria-current={section.isActive(pathname) ? 'page' : undefined}
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
                  {primaryItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex min-h-[42px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                        item.current
                          ? APP_SHELL_ACTIVE_NAV_CLASS
                          : 'text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground'
                      )}
                      aria-current={item.current ? 'page' : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
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
              {canAccessManagerUi ? (
                <Link
                  href="/therapist"
                  className="flex min-h-[38px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-[color:var(--sidebar-muted)] transition-colors hover:text-sidebar-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                  Switch to Therapist view
                </Link>
              ) : null}
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
                  className="flex min-h-11 w-full items-center rounded-lg px-2.5 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                >
                  Log out
                </button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
    </ThemeProvider>
  )
}
