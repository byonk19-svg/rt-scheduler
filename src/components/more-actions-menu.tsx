import type { ReactNode } from 'react'
import { Ellipsis } from 'lucide-react'

type MoreActionsMenuProps = {
  children: ReactNode
  label?: string
  /** Replaces default trigger styles (e.g. lighter secondary actions). */
  triggerClassName?: string
}

export function MoreActionsMenu({
  children,
  label = 'More',
  triggerClassName,
}: MoreActionsMenuProps) {
  const triggerStyles =
    triggerClassName ??
    'inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary'

  return (
    <details className="relative">
      <summary className="list-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span className={triggerStyles}>
          <Ellipsis className="h-4 w-4" />
          {label}
        </span>
      </summary>
      <div
        aria-label={`${label} actions`}
        className="absolute right-0 z-30 mt-2 w-52 rounded-md border border-border bg-card p-1 shadow-lg"
      >
        {children}
      </div>
    </details>
  )
}
