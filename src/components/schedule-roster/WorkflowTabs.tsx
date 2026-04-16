import Link from 'next/link'

import { cn } from '@/lib/utils'

export type WorkflowTab = {
  href: string
  label: string
  active: boolean
  badgeCount?: number
}

export function WorkflowTabs({
  tabs,
  ariaLabel,
  className,
}: {
  tabs: readonly WorkflowTab[]
  ariaLabel: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto px-1 py-1', className)}>
      <nav className="flex items-center gap-1" aria-label={ariaLabel}>
        {tabs.map((tab) => (
          <Link
            key={`${tab.href}-${tab.label}`}
            href={tab.href}
            aria-current={tab.active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              tab.active
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border/80'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            )}
          >
            <span>{tab.label}</span>
            {tab.badgeCount ? (
              <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--attention)] px-1.5 text-[10px] font-bold text-accent-foreground">
                {tab.badgeCount}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  )
}
