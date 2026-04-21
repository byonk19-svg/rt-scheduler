import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type WorkspaceMetricTone = 'neutral' | 'success' | 'warning' | 'critical'

export function CoverageMetric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail: string
  tone?: WorkspaceMetricTone
}) {
  const toneClasses: Record<WorkspaceMetricTone, string> = {
    neutral: 'border-border/70 bg-card text-foreground',
    success: 'border-[var(--success-border)]/55 bg-[var(--success-subtle)]/28 text-[var(--success-text)]',
    warning: 'border-[var(--warning-border)]/60 bg-[var(--warning-subtle)]/25 text-[var(--warning-text)]',
    critical: 'border-[var(--error-border)]/60 bg-[var(--error-subtle)]/28 text-[var(--error-text)]',
  }

  return (
    <div className={cn('rounded-lg border px-3 py-2.5 shadow-sm', toneClasses[tone])}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 flex items-end justify-between gap-3">
        <span className="text-[1.6rem] font-semibold tracking-[-0.04em]">{value}</span>
        <span className="text-[11px] font-medium text-muted-foreground">{detail}</span>
      </div>
    </div>
  )
}

export function CoverageSurfaceBanner({
  tone = 'neutral',
  title,
  description,
  actions,
}: {
  tone?: WorkspaceMetricTone
  title: string
  description: string
  actions?: ReactNode
}) {
  const toneClasses: Record<WorkspaceMetricTone, string> = {
    neutral: 'border-border/70 bg-muted/15',
    success: 'border-[var(--success-border)]/65 bg-[var(--success-subtle)]/28',
    warning: 'border-[var(--warning-border)]/70 bg-[var(--warning-subtle)]/28',
    critical: 'border-[var(--error-border)]/70 bg-[var(--error-subtle)]/28',
  }

  return (
    <section className={cn('rounded-lg border px-3.5 py-2.5', toneClasses[tone])}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}

export function CoverageSegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  testIdPrefix,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (nextValue: T) => void
  testIdPrefix?: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="inline-flex overflow-hidden rounded-lg border border-border/70 bg-background">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            data-testid={testIdPrefix ? `${testIdPrefix}-${option.value.toLowerCase()}` : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              value === option.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
