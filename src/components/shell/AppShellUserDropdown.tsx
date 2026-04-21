'use client'

import Link from 'next/link'
import { ChevronDown, LogOut, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { AppShellUser } from '@/components/AppShell'
import { cn } from '@/lib/utils'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TM'
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function AppShellUserDropdown({ user }: { user: AppShellUser | null }) {
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
        className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-sidebar-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring sm:min-h-10 sm:px-2 sm:py-1.5"
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
              className="flex min-h-11 items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground no-underline transition-colors hover:bg-muted hover:no-underline sm:min-h-10 sm:py-1.5"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              Settings
            </Link>
          </div>
          <div className="border-t border-border p-1">
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted sm:min-h-10 sm:py-1.5"
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
