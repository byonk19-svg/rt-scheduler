'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { NotificationBell } from '@/components/NotificationBell'

type StaffNavbarProps = {
  fullName: string
}

const NAV_ITEMS = [
  { href: '/staff/dashboard', label: 'Dashboard' },
  { href: '/staff/schedule', label: 'My Schedule' },
  { href: '/staff/requests', label: 'Requests' },
] as const

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'ST'
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function StaffNavbar({ fullName }: StaffNavbarProps) {
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
        <Link
          href="/staff/dashboard"
          className="shrink-0 text-sm font-extrabold tracking-tight text-stone-900"
        >
          Team<span style={{ color: '#d97706' }}>wise</span>
        </Link>

        <nav className="mx-auto hidden items-center gap-2 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#d97706] text-white'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <NotificationBell variant="staff" />

          <div className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: '#d97706' }}
              aria-hidden="true"
            >
              {initials(fullName)}
            </span>
            <span className="max-w-[9rem] truncate font-medium">{fullName}</span>
            <span className="hidden rounded-md border border-[#fde68a] bg-[#fffbeb] px-2 py-0.5 text-xs font-semibold text-[#b45309] sm:inline-flex">
              Staff
            </span>
          </div>

          <form action="/auth/signout" method="post" onSubmit={() => setSigningOut(true)}>
            <button
              type="submit"
              disabled={signingOut}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {signingOut && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-border md:hidden">
        <nav className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4 py-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[#d97706] text-white'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
