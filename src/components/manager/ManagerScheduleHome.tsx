import Link from 'next/link'

import { ArrowRight, CalendarDays } from 'lucide-react'

import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import type { ManagerScheduleHomeModel } from '@/lib/manager-schedule-home'

export function ManagerScheduleHome({ model }: { model: ManagerScheduleHomeModel }) {
  return (
    <div className="space-y-6">
      <ManagerWorkspaceHeader
        title="Schedule"
        subtitle="Start with the next action for the current block, then move into the detailed workflow pages."
        summary={
          <>
            <StatusBadge variant={model.cycleStatusTone} dot={false}>
              {model.cycleStatus}
            </StatusBadge>
            <span>{model.cycleLabel}</span>
            {model.cycleRange ? <span>{model.cycleRange}</span> : null}
          </>
        }
      />

      <Card className="border-border/70 bg-card/90 shadow-tw-float-tight">
        <CardHeader className="gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge variant={model.cycleStatusTone}>{model.cycleStatus}</StatusBadge>
            {model.cycleRange ? (
              <span className="text-xs text-muted-foreground">{model.cycleRange}</span>
            ) : null}
          </div>
          <CardTitle className="text-[1.4rem] tracking-tight">
            {model.primaryAction.label}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{model.primaryAction.description}</p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button asChild className="min-h-11 px-4">
            <Link href={model.primaryAction.href}>
              {model.primaryAction.label}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">{model.summary}</p>
        </CardContent>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {model.blockers.map((item) => (
          <Card key={item.label} className="border-border/70 bg-card/80 shadow-none">
            <CardHeader className="gap-2 pb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {item.label}
              </p>
              <CardTitle className="text-2xl">{item.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusBadge variant={item.tone}>{item.detail}</StatusBadge>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Workflow</h2>
            <p className="text-sm text-muted-foreground">
              Use these focused workspaces to move the current schedule block forward.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {model.workflowCards.map((card) => (
            <Card key={card.label} className="border-border/70 bg-card/85 shadow-none">
              <CardHeader className="gap-2 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{card.label}</CardTitle>
                  <StatusBadge variant={card.tone} dot={false}>
                    {card.status}
                  </StatusBadge>
                </div>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" size="sm" className="min-h-11 px-0 text-xs" asChild>
                  <Link href={card.href}>
                    Open {card.label}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Reference</h2>
          <p className="text-sm text-muted-foreground">
            Secondary views that support the workflow without replacing it.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {model.secondaryLinks.map((card) => (
            <Card key={card.label} className="border-border/70 bg-card/75 shadow-none">
              <CardHeader className="gap-2 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{card.label}</CardTitle>
                  <StatusBadge variant={card.tone} dot={false}>
                    {card.status}
                  </StatusBadge>
                </div>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" size="sm" className="min-h-11 px-0 text-xs" asChild>
                  <Link href={card.href}>
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                    Open {card.label}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
