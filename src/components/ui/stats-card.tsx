import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  label: string
  value: string | number
  sublabel?: string
  icon?: LucideIcon
  variant?: 'default' | 'success' | 'warning' | 'error'
  className?: string
  onClick?: () => void
  clickable?: boolean
}

export function StatsCard({
  label,
  value,
  sublabel,
  icon: Icon,
  variant = 'default',
  className,
  onClick,
  clickable = false,
}: StatsCardProps) {
  const Component = clickable ? 'button' : 'div'

  return (
    <Component
      onClick={onClick}
      className={cn(
        'rounded-xl border border-border bg-card px-5 py-4 text-left shadow-tw-md-soft',
        clickable &&
          'cursor-pointer transition-colors duration-150 hover:bg-muted/25 active:scale-[0.98]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn('mt-1 font-heading text-2xl font-semibold tracking-tight tabular-nums', {
              'text-foreground': variant === 'default',
              'text-[var(--success-text)]': variant === 'success',
              'text-[var(--warning-text)]': variant === 'warning',
              'text-[var(--error-text)]': variant === 'error',
            })}
          >
            {value}
          </p>
          {sublabel && <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>}
        </div>
        {Icon && (
          <div
            className={cn('flex-shrink-0 rounded-lg p-2', {
              'bg-muted': variant === 'default',
              'bg-[var(--success-subtle)]': variant === 'success',
              'bg-[var(--warning-subtle)]': variant === 'warning',
              'bg-[var(--error-subtle)]': variant === 'error',
            })}
          >
            <Icon
              className={cn('h-4 w-4', {
                'text-muted-foreground': variant === 'default',
                'text-[var(--success-text)]': variant === 'success',
                'text-[var(--warning-text)]': variant === 'warning',
                'text-[var(--error-text)]': variant === 'error',
              })}
            />
          </div>
        )}
      </div>
    </Component>
  )
}
