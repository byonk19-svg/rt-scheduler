import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type PageIntroProps = {
  title: string
  subtitle?: ReactNode
  summary?: ReactNode
  actions?: ReactNode
  className?: string
  titleClassName?: string
  compact?: boolean
}

export function PageIntro({
  title,
  subtitle,
  summary,
  actions,
  className,
  titleClassName,
  compact = false,
}: PageIntroProps) {
  return (
    <section data-page-intro className={cn('space-y-3', compact ? 'py-1' : 'py-2', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1
            className={cn(
              'app-page-title text-[1.55rem] leading-tight tracking-tight sm:text-[1.75rem]',
              titleClassName
            )}
          >
            {title}
          </h1>
          {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {summary ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {summary}
        </div>
      ) : null}
    </section>
  )
}
