import type { ReactNode } from 'react'

import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'

type AvailabilityOverviewHeaderProps = {
  title: string
  subtitle: string
  totalRequests: number
  needOffRequests: number
  availableToWorkRequests: number
  responseRatio: string | null
  actions?: ReactNode
  summaryContent?: ReactNode
}

export function AvailabilityOverviewHeader({
  title,
  subtitle,
  totalRequests,
  needOffRequests,
  availableToWorkRequests,
  responseRatio,
  actions,
  summaryContent,
}: AvailabilityOverviewHeaderProps) {
  return (
    <ManagerWorkspaceHeader
      title={title}
      titleClassName="app-page-title max-w-[min(100%,38rem)] text-xl sm:text-[1.55rem] md:text-[1.75rem]"
      subtitle={subtitle}
      actions={actions}
      summary={
        summaryContent ?? (
          <>
            <span className="text-sm font-semibold text-foreground">{totalRequests}</span>
            <span className="text-muted-foreground">requests on file</span>
            <span className="text-border/90" aria-hidden="true">
              ·
            </span>
            <span className="text-muted-foreground">{needOffRequests} need off</span>
            <span className="text-border/90" aria-hidden="true">
              /
            </span>
            <span className="text-muted-foreground">{availableToWorkRequests} request to work</span>
            {responseRatio ? (
              <>
                <span className="text-border/90" aria-hidden="true">
                  ·
                </span>
                <span className="text-muted-foreground">{responseRatio} responded</span>
              </>
            ) : null}
          </>
        )
      }
    />
  )
}
