'use client'

import { CalendarDays, CheckCircle2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { OpenRequest } from '@/components/requests/request-types'

const STATUS_META: Record<
  OpenRequest['status'],
  { label: string; colorClass: string; bgClass: string; borderClass: string }
> = {
  pending: {
    label: 'Pending',
    colorClass: 'text-[var(--warning-text)]',
    bgClass: 'bg-[var(--warning-subtle)]',
    borderClass: 'border-[var(--warning-border)]',
  },
  approved: {
    label: 'Approved',
    colorClass: 'text-[var(--success-text)]',
    bgClass: 'bg-[var(--success-subtle)]',
    borderClass: 'border-[var(--success-border)]',
  },
  denied: {
    label: 'Denied',
    colorClass: 'text-[var(--error-text)]',
    bgClass: 'bg-[var(--error-subtle)]',
    borderClass: 'border-[var(--error-border)]',
  },
  expired: {
    label: 'Expired',
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
    borderClass: 'border-border',
  },
}

export function RequestOpenRequestCard({ request }: { request: OpenRequest }) {
  const meta = STATUS_META[request.status]
  const isPending = request.status === 'pending'

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4',
        isPending ? 'border-[var(--warning-border)] shadow-sm' : 'border-border'
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            request.type === 'swap'
              ? 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
              : 'border-border bg-secondary text-foreground'
          )}
        >
          {request.type}
        </span>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            meta.borderClass,
            meta.bgClass,
            meta.colorClass
          )}
        >
          {meta.label}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{request.posted}</span>
      </div>

      <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-1">
        <CalendarDays className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">{request.shift}</span>
      </div>

      <p className="text-sm text-muted-foreground">{request.message}</p>

      {request.swapWith ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Swap with: <span className="font-medium text-foreground">{request.swapWith}</span>
        </p>
      ) : null}

      {request.status === 'approved' ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--success-text)]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Approved by manager
        </div>
      ) : null}
    </div>
  )
}
