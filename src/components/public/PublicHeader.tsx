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
    ctaLabel: 'Get started',
  }
}

export function PublicHeader({ className }: { className?: string }) {
  const pathname = usePathname()
  const actions = getHeaderActions(pathname)

  return (
    <header className={cn('border-b border-border/50 bg-background/90', className)}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 hover:no-underline">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--attention)] shadow-tw-md-soft">
            <CalendarDays className="h-4 w-4 text-accent-foreground" />
          </span>
          <span>
            <span className="block font-heading text-sm font-bold tracking-[-0.02em] text-foreground">
              Teamwise
            </span>
            <span className="block text-[0.72rem] font-medium text-muted-foreground">
              Respiratory Therapy
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="text-foreground/80 hover:bg-card/75">
            <Link href={actions.secondaryHref}>{actions.secondaryLabel}</Link>
          </Button>
          <Button asChild size="sm" className="rounded-xl px-5 shadow-tw-primary-glow">
            <Link href={actions.ctaHref}>{actions.ctaLabel}</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
