import type { ReactNode } from 'react'
import { CheckCircle2, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SummaryItem({
  label,
  value,
  variant,
}: {
  label: string
  value: number | string
  variant: 'warning' | 'error' | 'success'
}) {
  const colorClass =
    variant === 'warning'
      ? 'text-[var(--warning-text)]'
      : variant === 'error'
        ? 'text-[var(--error-text)]'
        : 'text-[var(--success-text)]'
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('text-2xl font-bold leading-none', colorClass)}>{value}</span>
      <span className="whitespace-nowrap text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

export function KpiTile({
  label,
  value,
  detail,
  icon,
}: {
  label: string
  value: number | string
  detail: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

export function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 rounded-md border px-3 text-xs font-semibold transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_35%,transparent)]'
          : 'border-border bg-card text-muted-foreground hover:bg-secondary'
      )}
    >
      {label}
    </button>
  )
}

export function EmptyState({
  statusFilter,
  onClear,
}: {
  statusFilter: string
  onClear: () => void
}) {
  const allClear = statusFilter === 'pending'
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
      <div
        className={cn(
          'mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border',
          allClear
            ? 'border-[var(--success-border)] bg-[var(--success-subtle)]'
            : 'border-border bg-muted'
        )}
      >
        {allClear ? (
          <CheckCircle2 className="h-5 w-5 text-[var(--success-text)]" />
        ) : (
          <Search className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <p className="mb-1 text-sm font-bold text-foreground">
        {allClear ? "You're all caught up" : 'No results found'}
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        {allClear
          ? 'No pending requests right now. Check back later.'
          : 'Try adjusting your search or filters.'}
      </p>
      <Button size="sm" variant="outline" onClick={onClear}>
        {allClear ? 'View all posts' : 'Clear filters'}
      </Button>
    </div>
  )
}
