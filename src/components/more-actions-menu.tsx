import type { ReactNode } from 'react'
import { Ellipsis } from 'lucide-react'

type MoreActionsMenuProps = {
  children: ReactNode
  label?: string
}

export function MoreActionsMenu({ children, label = 'More' }: MoreActionsMenuProps) {
  return (
    <details className="relative">
      <summary className="list-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary">
          <Ellipsis className="h-4 w-4" />
          {label}
        </span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-52 rounded-md border border-border bg-white p-1 shadow-lg">
        {children}
      </div>
    </details>
  )
}
