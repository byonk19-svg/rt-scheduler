import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

type ManagerTriageDashboardProps = {
  approvalsWaiting: number | '--'
  currentCycleStatus: string
  currentCycleDetail: string
  nextCycleLabel: string
  nextCycleDetail: string
  needsReviewCount: number | '--'
  needsReviewDetail: string
  approvalsHref: string
  scheduleHref: string
  reviewHref: string
  onNavigate: (href: string) => void
}

export function ManagerTriageDashboard({
  approvalsWaiting,
  currentCycleStatus,
  currentCycleDetail,
  nextCycleLabel,
  nextCycleDetail,
  needsReviewCount,
  needsReviewDetail,
  approvalsHref,
  scheduleHref,
  reviewHref,
  onNavigate,
}: ManagerTriageDashboardProps) {
  return (
    <div className="max-w-5xl px-6 py-8 xl:px-8">
      <section className="border-b border-border/70 pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          What needs attention now
        </p>

        <div className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
          <SignalBlock
            label="Pending approvals"
            value={approvalsWaiting === '--' ? '--' : String(approvalsWaiting)}
            detail={
              approvalsWaiting === '--'
                ? 'Loading'
                : approvalsWaiting === 1
                  ? '1 waiting'
                  : `${approvalsWaiting} waiting`
            }
            actionLabel="Review approvals"
            onClick={() => onNavigate(approvalsHref)}
          />

          <SignalBlock
            label="Current cycle"
            value={currentCycleStatus}
            detail={currentCycleDetail}
            actionLabel="Open schedule"
            onClick={() => onNavigate(scheduleHref)}
          />

          <SignalBlock
            label="Next 6-week cycle"
            value={nextCycleLabel}
            detail={nextCycleDetail}
            actionLabel="Open availability"
            onClick={() => onNavigate('/availability')}
          />

          <SignalBlock
            label="Needs review"
            value={needsReviewCount === '--' ? '--' : String(needsReviewCount)}
            detail={needsReviewDetail}
            actionLabel="Review updates"
            onClick={() => onNavigate(reviewHref)}
          />
        </div>
      </section>
    </div>
  )
}

function SignalBlock({
  actionLabel,
  detail,
  label,
  onClick,
  value,
}: {
  actionLabel: string
  detail: string
  label: string
  onClick: () => void
  value: string
}) {
  return (
    <div className="border-l border-border/80 pl-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 font-heading text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[0.95] tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      <Button variant="ghost" size="sm" className="mt-4 gap-1 px-0" onClick={onClick}>
        {actionLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
