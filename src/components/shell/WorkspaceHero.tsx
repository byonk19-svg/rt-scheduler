import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type WorkspaceHeroMetric = {
  label: string
  value: ReactNode
  accentClassName?: string
}

type WorkspaceHeroProps = {
  eyebrow: string
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  metrics?: WorkspaceHeroMetric[]
  tabs?: ReactNode
  className?: string
}

export function WorkspaceHero({
  eyebrow,
  title,
  subtitle,
  actions,
  metrics = [],
  tabs,
  className,
}: WorkspaceHeroProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[28px] bg-[var(--sidebar)] text-sidebar-primary shadow-tw-panel',
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(color-mix(in srgb, white 85%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, white 85%, transparent) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--attention)]/85 sm:left-auto sm:right-0"
      />

      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-3">
              <span className="h-0.5 w-6 shrink-0 rounded-full bg-[var(--attention)]" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/60">
                {eyebrow}
              </p>
            </div>
            <h1 className="font-display text-[2.35rem] font-semibold leading-none tracking-[-0.035em] text-sidebar-primary sm:text-[2.8rem]">
              {title}
            </h1>
            {subtitle ? (
              <div className="mt-3 max-w-3xl text-sm leading-6 text-sidebar-foreground/72">
                {subtitle}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        </div>

        {metrics.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center gap-6">
            {metrics.map((metric) => (
              <div key={metric.label} className="min-w-[5rem]">
                <div
                  className={cn(
                    'text-2xl font-bold leading-none text-sidebar-primary tabular-nums',
                    metric.accentClassName
                  )}
                >
                  {metric.value}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-sidebar-foreground/55">
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tabs ? <div className="mt-5">{tabs}</div> : null}
      </div>
    </section>
  )
}
