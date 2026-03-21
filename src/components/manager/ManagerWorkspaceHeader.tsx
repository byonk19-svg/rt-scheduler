import type { ReactNode } from 'react'

type ManagerWorkspaceHeaderProps = {
  title: string
  subtitle: string
  summary?: ReactNode
  actions?: ReactNode
  className?: string
}

export function ManagerWorkspaceHeader({
  title,
  subtitle,
  summary,
  actions,
  className,
}: ManagerWorkspaceHeaderProps) {
  return (
    <div
      className={`border-b border-border/70 bg-card/80 px-6 pb-5 pt-5 ${className ?? ''}`.trim()}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-[1.15rem] font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>

        {actions ? <div className="flex items-center gap-2.5">{actions}</div> : null}
      </div>

      {summary ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">{summary}</div>
      ) : null}
    </div>
  )
}
