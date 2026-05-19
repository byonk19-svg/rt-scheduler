import type { ReactNode } from 'react'

import { PageIntro } from '@/components/shell/PageIntro'

type ManagerWorkspaceHeaderProps = {
  title: string
  subtitle: ReactNode
  summary?: ReactNode
  actions?: ReactNode
  className?: string
  /** Override default h1 styling (e.g. `app-page-title` on availability). */
  titleClassName?: string
  compact?: boolean
}

export function ManagerWorkspaceHeader({
  title,
  subtitle,
  summary,
  actions,
  className,
  titleClassName,
  compact,
}: ManagerWorkspaceHeaderProps) {
  return (
    <PageIntro
      title={title}
      subtitle={subtitle}
      summary={summary}
      actions={actions}
      className={className}
      titleClassName={titleClassName}
      compact={compact}
    />
  )
}
