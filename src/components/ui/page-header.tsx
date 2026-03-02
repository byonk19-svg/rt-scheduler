import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  subtitle?: string
  badge?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * Shared page header used across all primary route pages.
 * Provides consistent h1 sizing, subtitle, optional badge chips,
 * and a right-side actions slot.
 *
 * Usage:
 *   <PageHeader
 *     title="Manager Dashboard"
 *     subtitle="Build coverage first, then publish confidently."
 *     badge={<Badge>Manager</Badge>}
 *     actions={<Button size="sm">Fix coverage</Button>}
 *   />
 */
export function PageHeader({ title, subtitle, badge, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'teamwise-surface rounded-2xl border border-border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="app-page-title">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          {badge && <div className="mt-3 flex flex-wrap items-center gap-2">{badge}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
