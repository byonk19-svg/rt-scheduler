import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export type StatusBadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending'

const variantStyles: Record<StatusBadgeVariant, { badge: string; dot: string }> = {
  success: {
    badge: 'bg-[var(--success-subtle)] text-[var(--success-text)]',
    dot: 'bg-[var(--success)]',
  },
  warning: {
    badge: 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
    dot: 'bg-[var(--warning)]',
  },
  error: {
    badge: 'bg-[var(--error-subtle)] text-[var(--error-text)]',
    dot: 'bg-[var(--error)]',
  },
  info: {
    badge: 'bg-[var(--info-subtle)] text-[var(--info-text)]',
    dot: 'bg-[var(--info)]',
  },
  neutral: {
    badge: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
  pending: {
    badge: 'bg-accent/15 text-accent-foreground',
    dot: 'bg-accent',
  },
}

interface StatusBadgeProps {
  variant?: StatusBadgeVariant
  children: ReactNode
  dot?: boolean
  className?: string
}

export function StatusBadge({
  variant = 'neutral',
  children,
  dot = true,
  className,
}: StatusBadgeProps) {
  const styles = variantStyles[variant]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium font-heading transition-colors',
        styles.badge,
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)} />}
      {children}
    </span>
  )
}
