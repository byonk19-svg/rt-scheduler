import Link from 'next/link'
import { Bell, CalendarDays, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

const PRIMARY_NAV = [
  { href: '/dashboard/manager', label: 'Today' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/team', label: 'People' },
] as const

export function TopAppHeader() {
  return (
    <header className="border-b border-border/80 bg-card/90 shadow-sm">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <Link href="/schedule" className="flex items-center gap-3 hover:no-underline">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sidebar text-sidebar-primary shadow-sm">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-heading text-lg font-semibold tracking-[-0.03em] text-foreground">
                  Teamwise
                </span>
                <span className="block text-sm text-muted-foreground">Respiratory Therapy</span>
              </span>
            </Link>

            <nav className="flex items-center gap-1" aria-label="Primary navigation">
              {PRIMARY_NAV.map((item) => {
                const active = item.label === 'Schedule'
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/70 hover:no-underline',
                      active
                        ? 'bg-sidebar text-sidebar-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3 self-end lg:self-auto">
            <button
              type="button"
              aria-label="Notifications"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-background text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--attention)] text-xs font-bold text-accent-foreground">
                DM
              </span>
              <span>Demo Manager</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
