import type { ReactNode } from 'react'

type ManagerWorkspaceHeaderProps = {
  title: string
  subtitle: ReactNode
  summary?: ReactNode
  actions?: ReactNode
  className?: string
  /** Override default h1 styling (e.g. `app-page-title` on availability). */
  titleClassName?: string
}

export function ManagerWorkspaceHeader({
  title,
  subtitle,
  summary,
  actions,
  className,
  titleClassName,
}: ManagerWorkspaceHeaderProps) {
  return (
    <div
      className={`border-b border-border/70 bg-card/80 px-6 pb-2.5 pt-2.5 ${className ?? ''}`.trim()}
    >
      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1
            className={
              titleClassName ??
              'font-heading text-[1.25rem] font-semibold leading-tight tracking-tight text-foreground'
            }
          >
            {title}
          </h1>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
        ) : null}
      </div>

      {summary ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {summary}
        </div>
      ) : null}
    </div>
  )
}
