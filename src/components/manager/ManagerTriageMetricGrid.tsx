import Link from 'next/link'
import type { ReactNode } from 'react'
import { FileCheck, Shield, Users } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const LOADING_LABEL = 'Loading...'

function MetricCard({
  title,
  value,
  detail,
  href,
  icon,
  tone,
}: {
  title: string
  value: string
  detail: string
  href: string
  icon: ReactNode
  tone: 'error' | 'warning' | 'info'
}) {
  const isEmpty = value === '0' || value === '0%' || value === '--'
  const toneClasses = {
    error: {
      badge: 'bg-[var(--error-subtle)] text-[var(--error-text)]',
    },
    warning: {
      badge: 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
    },
    info: {
      badge: 'bg-[var(--info-subtle)] text-[var(--info-text)]',
    },
  }[tone]

  return (
    <Link href={href} className="block">
      <Card
        className={cn(
          'relative overflow-hidden rounded-[24px] border-border/70 bg-card/95 shadow-tw-metric transition-transform duration-200 hover:-translate-y-0.5',
          isEmpty && 'border-dashed bg-muted/20 shadow-none'
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-foreground">{title}</CardTitle>
          <div className={cn('rounded-full p-2', toneClasses.badge)}>{icon}</div>
        </CardHeader>
        <CardContent className="space-y-1 pb-4">
          <p
            className={cn(
              'font-heading tabular-nums leading-none tracking-[-0.04em]',
              isEmpty
                ? 'text-xl font-semibold text-muted-foreground'
                : 'text-4xl font-bold text-foreground'
            )}
          >
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

export function ManagerTriageMetricGrid({
  approvalsHref,
  pendingRequests,
  scheduleHref,
  todayCoverageCovered,
  todayCoverageTotal,
  upcomingShiftCount,
}: {
  approvalsHref: string
  pendingRequests: number | '--'
  scheduleHref: string
  todayCoverageCovered: number | '--'
  todayCoverageTotal: number | '--'
  upcomingShiftCount: number | '--'
}) {
  const riskCount =
    todayCoverageCovered === '--' || todayCoverageTotal === '--'
      ? '--'
      : Math.max(todayCoverageTotal - todayCoverageCovered, 0)
  const riskCountLabel =
    riskCount === '--' ? LOADING_LABEL : `${riskCount} ${riskCount === 1 ? 'issue' : 'issues'}`
  const pendingRequestLabel =
    pendingRequests === '--' ? LOADING_LABEL : `${pendingRequests} pending`
  const teamLoadLabel =
    upcomingShiftCount === '--' ? LOADING_LABEL : `${upcomingShiftCount} upcoming shifts`

  const metricCards = [
    {
      title: 'Coverage Issues',
      value: riskCount === '--' ? '--' : String(riskCount),
      detail: riskCountLabel,
      href: scheduleHref,
      icon: <Shield className="h-4 w-4 text-[var(--error-text)]" />,
      tone: 'error' as const,
    },
    {
      title: 'Pending Approvals',
      value: pendingRequests === '--' ? '--' : String(pendingRequests),
      detail: pendingRequestLabel,
      href: approvalsHref,
      icon: <FileCheck className="h-4 w-4 text-[var(--warning-text)]" />,
      tone: 'warning' as const,
    },
    {
      title: 'Upcoming Shifts',
      value: upcomingShiftCount === '--' ? '--' : String(upcomingShiftCount),
      detail: teamLoadLabel,
      href: scheduleHref,
      icon: <Users className="h-4 w-4 text-primary" />,
      tone: 'info' as const,
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {metricCards.map((card) => (
        <div key={card.title}>
          <MetricCard {...card} />
        </div>
      ))}
    </div>
  )
}
