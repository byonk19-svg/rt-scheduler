import type { ReactNode } from 'react'

import { PageIntro } from '@/components/shell/PageIntro'
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
        'relative overflow-hidden rounded-2xl border border-border/90 px-5 py-4',
        'bg-[color-mix(in_oklch,var(--card)_92%,var(--secondary))]',
        'shadow-tw-header',
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ backgroundColor: 'color-mix(in oklch, var(--primary) 24%, transparent)' }}
        aria-hidden="true"
      />

      <PageIntro
        title={title}
        subtitle={subtitle}
        summary={
          badge ? <div className="flex flex-wrap items-center gap-2">{badge}</div> : undefined
        }
        actions={actions}
        className="relative"
      />
    </div>
  )
}
