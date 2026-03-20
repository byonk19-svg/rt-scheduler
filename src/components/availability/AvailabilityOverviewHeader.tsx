import type { ReactNode } from 'react'

import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'

type AvailabilityOverviewHeaderProps = {
  canManageAvailability: boolean
  title: string
  subtitle: string
  totalRequests: number
  needOffRequests: number
  availableToWorkRequests: number
  responseRatio: string | null
  actions?: ReactNode
}

export function AvailabilityOverviewHeader({
  canManageAvailability,
  title,
  subtitle,
  totalRequests,
  needOffRequests,
  availableToWorkRequests,
  responseRatio,
  actions,
}: AvailabilityOverviewHeaderProps) {
  return (
    <ManagerWorkspaceHeader
      title={title}
      subtitle={subtitle}
      actions={actions}
      summary={
        <>
          <span className="rounded-full border border-border/70 bg-muted/15 px-3 py-1 font-medium text-foreground">
            {totalRequests} requests on file
          </span>
          <span className="text-muted-foreground">{needOffRequests} need off</span>
          <span className="text-border/90" aria-hidden="true">
            /
          </span>
          <span className="text-muted-foreground">{availableToWorkRequests} available to work</span>
          {!canManageAvailability && responseRatio ? (
            <>
              <span className="text-border/90" aria-hidden="true">
                /
              </span>
              <span className="text-muted-foreground">{responseRatio} responded</span>
            </>
          ) : null}
        </>
      }
    />
  )
}
