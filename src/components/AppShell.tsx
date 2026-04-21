'use client'

import ThemeProvider from '@/components/ThemeProvider'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { DeferredNotificationBell } from '@/components/DeferredNotificationBell'
import { AppShellMobileNav } from '@/components/shell/AppShellMobileNav'
import { AppShellUserDropdown } from '@/components/shell/AppShellUserDropdown'
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

export default function AppShell({ user, unreadNotificationCount = 0, children }: AppShellProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const canAccessManagerUi = can(user?.role, 'access_manager_ui')
  const [fetchedPendingCount, setFetchedPendingCount] = useState<number | null>(null)

  const shouldRenderShell = useMemo(() => Boolean(user) && usesAppShell(pathname), [pathname, user])

  const dashboardHref = canAccessManagerUi ? MANAGER_WORKFLOW_LINKS.dashboard : '/dashboard/staff'
  const pendingCount = user?.pendingAccessRequests ?? fetchedPendingCount ?? 0
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

  useEffect(() => {
    if (!canAccessManagerUi) return
    if (user?.pendingAccessRequests !== undefined) return

    let cancelled = false

    async function loadPendingSummary() {
      const response = await fetch('/api/requests/user-access?summary=1', { cache: 'no-store' })
      if (!response.ok || cancelled) return
      const data = (await response.json()) as { pendingCount?: number }
      if (cancelled) return
      setFetchedPendingCount(data.pendingCount ?? 0)
    }

    void loadPendingSummary()

    return () => {
      cancelled = true
    }
  }, [canAccessManagerUi, user?.pendingAccessRequests])

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
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
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
              <AppShellUserDropdown user={user} />
            </>
          }
          mobileToggle={
            <AppShellMobileNav
              APP_SHELL_ACTIVE_NAV_CLASS={APP_SHELL_ACTIVE_NAV_CLASS}
              APP_SHELL_PROFILE_CARD_CLASS={APP_SHELL_PROFILE_CARD_CLASS}
              canAccessManagerUi={canAccessManagerUi}
              initials={initials}
              managerSections={managerSections}
              mobileMenuOpen={mobileMenuOpen}
              onClose={() => setMobileMenuOpen(false)}
              onToggle={() => setMobileMenuOpen((open) => !open)}
              primaryItems={primaryItems}
              user={user}
            />
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
                <LocalSectionNav
                  ariaLabel={shellContext.localNav.ariaLabel}
                  items={localNavItems}
                />
              </div>
            ) : null}
            {children}
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}
