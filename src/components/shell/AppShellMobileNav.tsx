'use client'

import Link from 'next/link'
import { Menu, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function AppShellMobileNav({
  APP_SHELL_ACTIVE_NAV_CLASS,
  APP_SHELL_PROFILE_CARD_CLASS,
  canAccessManagerUi,
  initials,
  managerSections,
  mobileMenuOpen,
  onClose,
  onToggle,
  primaryItems,
  user,
}: {
  APP_SHELL_ACTIVE_NAV_CLASS: string
  APP_SHELL_PROFILE_CARD_CLASS: string
  canAccessManagerUi: boolean
  initials: (name: string) => string
  managerSections: ReadonlyArray<{
    key: string
    label: string
    href: string
    isActive: (pathname: string) => boolean
    subItems: ReadonlyArray<{
      href: string
      label: string
      active: (pathname: string) => boolean
      badgeCount?: number
    }>
  }>
  mobileMenuOpen: boolean
  onClose: () => void
  onToggle: () => void
  primaryItems: Array<{
    href: string
    label: string
    current: boolean
  }>
  user: { fullName: string; role: string } | null
}) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        onClick={onToggle}
        aria-expanded={mobileMenuOpen}
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

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
            onClick={onClose}
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
              <span className="text-sm font-semibold text-sidebar-primary">Navigation</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={onClose}
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
                          const active = item.active(
                            primaryItems.find((i) => i.current)?.href ?? ''
                          )
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
                              onClick={onClose}
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
                        className="flex min-h-[42px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground"
                        onClick={onClose}
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
                      onClick={onClose}
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
              <Link
                href="/settings"
                className="flex min-h-[38px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/45"
                onClick={onClose}
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
      ) : null}
    </>
  )
}
