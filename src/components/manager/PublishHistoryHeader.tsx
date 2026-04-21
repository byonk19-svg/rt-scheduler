'use client'

import Link from 'next/link'
import { CalendarDays, CheckCircle2, CircleX, Clock3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'

export function PublishHistoryHeader({
  failedCount,
  queuedCount,
  successCount,
}: {
  failedCount: number
  queuedCount: number
  successCount: number
}) {
  return (
    <div className="border-b border-border bg-card px-6 pb-4 pt-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
            Delivery history
          </h1>
          <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
            Review publish email runs, delivery counts, and detailed event logs.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="text-xs">
          <Link href="/publish">
            <CalendarDays className="h-3.5 w-3.5" />
            Back to finalize schedule
          </Link>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge variant="success">
          <CheckCircle2 className="h-3 w-3" />
          {successCount} successful
        </StatusBadge>
        <StatusBadge variant="error">
          <CircleX className="h-3 w-3" />
          {failedCount} failed
        </StatusBadge>
        <StatusBadge variant="warning">
          <Clock3 className="h-3 w-3" />
          {queuedCount} queued
        </StatusBadge>
      </div>
    </div>
  )
}
