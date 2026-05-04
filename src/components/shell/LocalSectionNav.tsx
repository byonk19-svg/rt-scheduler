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
      <div className="flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto sm:flex-wrap sm:overflow-visible">
        {items.map((item) => (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            aria-current={item.current ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium transition-colors sm:min-h-10 sm:py-1.5',
              item.current
                ? 'border-[var(--attention)] text-foreground'
                : 'text-muted-foreground hover:text-foreground'
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
