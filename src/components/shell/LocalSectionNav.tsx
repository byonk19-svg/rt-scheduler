import Link from 'next/link'

import { cn } from '@/lib/utils'

type LocalSectionNavItem = {
  href: string
  label: string
  current: boolean
  badgeCount?: number
}

type LocalSectionNavProps = {
  ariaLabel: string
  items: readonly LocalSectionNavItem[]
  className?: string
}

export function LocalSectionNav({ ariaLabel, items, className }: LocalSectionNavProps) {
  return (
    <nav aria-label={ariaLabel} className={className}>
      <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border/70 bg-muted/20 p-1">
        {items.map((item) => (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            aria-current={item.current ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-9 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              item.current
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border/80'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            )}
          >
            <span>{item.label}</span>
            {item.badgeCount ? (
              <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--attention)] px-1.5 text-[10px] font-bold text-accent-foreground">
                {item.badgeCount}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  )
}
