'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function getHeaderActions(pathname: string) {
  if (pathname === '/login') {
    return {
      secondaryHref: '/',
      secondaryLabel: 'Home',
      ctaHref: '/signup',
      ctaLabel: 'Create account',
    }
  }

  if (pathname === '/signup') {
    return {
      secondaryHref: '/',
      secondaryLabel: 'Home',
      ctaHref: '/login',
      ctaLabel: 'Sign in',
    }
  }

  if (pathname === '/reset-password') {
    return {
      secondaryHref: '/',
      secondaryLabel: 'Home',
      ctaHref: '/login',
      ctaLabel: 'Back to sign in',
    }
  }

  return {
    secondaryHref: '/login',
    secondaryLabel: 'Sign in',
    ctaHref: '/signup',
    ctaLabel: 'Create account',
  }
}

export default function PublicHeader({ className }: { className?: string }) {
  const pathname = usePathname()
  const actions = getHeaderActions(pathname)
  const isHome = pathname === '/'

  return (
    <header
      className={cn(
        'border-b',
        isHome
          ? 'border-white/8 bg-[var(--sidebar)] text-sidebar-primary'
          : 'border-border/50 bg-background/90',
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex min-h-11 items-center gap-3 hover:no-underline">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--attention)] shadow-tw-md-soft">
            <CalendarDays
              className={cn('h-4 w-4', isHome ? 'text-[var(--sidebar)]' : 'text-accent-foreground')}
            />
          </span>
          <span>
            <span
              className={cn(
                'block font-heading text-sm font-bold tracking-[-0.02em]',
                isHome ? 'text-sidebar-primary' : 'text-foreground'
              )}
            >
              Teamwise
            </span>
            <span
              className={cn(
                'block text-[0.72rem] font-medium',
                isHome ? 'text-sidebar-foreground/70' : 'text-muted-foreground'
              )}
            >
              Respiratory Therapy
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              isHome
                ? 'text-sidebar-primary/70 hover:bg-white/8 hover:text-sidebar-primary'
                : 'text-foreground/80 hover:bg-card/75'
            )}
          >
            <Link href={actions.secondaryHref}>{actions.secondaryLabel}</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className={cn(
              'rounded-xl px-5',
              isHome
                ? 'bg-[var(--attention)] text-[var(--sidebar)] shadow-none hover:brightness-105'
                : 'shadow-tw-primary-glow'
            )}
          >
            <Link href={actions.ctaHref}>{actions.ctaLabel}</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
