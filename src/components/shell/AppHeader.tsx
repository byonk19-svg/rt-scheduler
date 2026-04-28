'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { APP_PAGE_MAX_WIDTH_CLASS } from '@/components/shell/app-shell-config'

type AppHeaderProps = {
  brand: ReactNode
  primaryNav: ReactNode
  utilityActions: ReactNode
  mobileToggle: ReactNode
  className?: string
}

export function AppHeader({
  brand,
  primaryNav,
  utilityActions,
  mobileToggle,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        'no-print print:hidden fixed inset-x-0 top-0 z-30 border-b border-sidebar-border/80 text-sidebar-foreground shadow-tw-app-chrome app-shell-chrome-primary',
        className
      )}
    >
      <div className={cn('flex h-11 items-center gap-3', APP_PAGE_MAX_WIDTH_CLASS)}>
        <div className="shrink-0">{brand}</div>
        <div className="min-w-0 flex-1">{primaryNav}</div>
        <div className="ml-auto flex items-center gap-1">{utilityActions}</div>
        <div className="md:hidden">{mobileToggle}</div>
      </div>
    </header>
  )
}
