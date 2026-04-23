'use client'

import Link from 'next/link'
import { CalendarDays, CheckCircle2, CircleX, History } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'

export function FinalizeScheduleHeader({
  draftCount,
  liveCount,
}: {
  draftCount: number
  liveCount: number
}) {
  return (
    <>
      <div className="border-b border-border bg-card px-6 pb-4 pt-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
              Finalize schedule
            </h1>
            <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
              Move draft blocks toward publish, or take live blocks back to draft when staffing
              changes.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link href="/publish/history">
              <History className="h-3.5 w-3.5" />
              Delivery history
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge variant="success">
            <CheckCircle2 className="h-3 w-3" />
            {liveCount} live
          </StatusBadge>
          <StatusBadge variant="warning">
            <CircleX className="h-3 w-3" />
            {draftCount} draft
          </StatusBadge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <section className="rounded-xl border border-border/70 bg-card px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Draft blocks</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Open a draft block in Schedule to review assignments, send a preliminary schedule, and
            publish when it is ready.
          </p>
        </section>
        <section className="rounded-xl border border-border/70 bg-card px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Live blocks</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Take a live block offline to keep assignments as draft, or clear and restart if the
            published grid needs to be rebuilt.
          </p>
        </section>
        <section className="rounded-xl border border-border/70 bg-card px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Delivery history</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Review publish email runs, failed recipients, and detailed delivery logs on the history
            page.
          </p>
        </section>
      </div>
    </>
  )
}
