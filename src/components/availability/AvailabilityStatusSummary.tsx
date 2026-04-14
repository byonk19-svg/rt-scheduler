'use client'

import { useState } from 'react'

import { cn } from '@/lib/utils'

export type AvailabilityStatusSummaryRow = {
  therapistId: string
  therapistName: string
  overridesCount?: number
}

type AvailabilityStatusSummaryProps = {
  submittedRows: AvailabilityStatusSummaryRow[]
  missingRows: AvailabilityStatusSummaryRow[]
}

function pluralizeTherapists(count: number): string {
  return `${count} therapist${count === 1 ? '' : 's'}`
}

function TherapistRow({
  name,
  subtitle,
  tone,
}: {
  name: string
  subtitle: string
  tone: 'warning' | 'success'
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-2.5 py-2 shadow-tw-sm">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-bold uppercase text-muted-foreground">
        {name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{name}</p>
        <div className="mt-0.5 flex items-center gap-1">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              tone === 'warning' ? 'bg-[var(--warning-text)]' : 'bg-[var(--success-text)]'
            )}
          />
          <span className="text-[10px] font-medium text-muted-foreground">{subtitle}</span>
        </div>
      </div>
    </div>
  )
}

export function AvailabilityStatusSummary({
  submittedRows,
  missingRows,
}: AvailabilityStatusSummaryProps) {
  const [activeTab, setActiveTab] = useState<'missing' | 'submitted'>('missing')

  const total = submittedRows.length + missingRows.length
  const submittedPct = total > 0 ? Math.round((submittedRows.length / total) * 100) : 0

  return (
    <section className="flex h-full flex-col" aria-labelledby="availability-response-heading">
      <div className="border-b border-border/80 px-5 py-4">
        <div className="flex items-center justify-between">
          <h2
            id="availability-response-heading"
            className="text-sm font-bold tracking-[-0.01em] text-foreground"
          >
            Response roster
          </h2>
          <span className="text-xs font-semibold text-foreground">
            {submittedRows.length}
            <span className="font-normal text-muted-foreground">/{total}</span>
          </span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[var(--success-text)] transition-all duration-300"
            style={{ width: `${submittedPct}%` }}
            role="progressbar"
            aria-valuenow={submittedPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${submittedRows.length} of ${total} therapists submitted`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-border/80 bg-muted/40">
        <button
          type="button"
          className={cn(
            'border-b-2 px-4 py-2.5 text-left text-xs font-bold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2',
            activeTab === 'missing'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('missing')}
        >
          Not submitted yet{' '}
          <span className="ml-1 rounded-full bg-[var(--warning-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--warning-text)]">
            {missingRows.length}
          </span>
        </button>
        <button
          type="button"
          className={cn(
            'border-b-2 px-4 py-2.5 text-left text-xs font-bold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2',
            activeTab === 'submitted'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('submitted')}
        >
          Submitted{' '}
          <span className="ml-1 rounded-full bg-[var(--success-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--success-text)]">
            {submittedRows.length}
          </span>
        </button>
      </div>

      <div className="max-h-[540px] overflow-y-auto p-3">
        <div className={cn('space-y-2', activeTab !== 'missing' && 'hidden')}>
          <p className="px-1 pt-1 text-[11px] font-medium text-muted-foreground">
            {missingRows.length > 0
              ? `${pluralizeTherapists(missingRows.length)} still need to respond`
              : 'Everyone has submitted availability for this cycle.'}
          </p>

          {missingRows.length > 0 ? (
            missingRows.map((row) => (
              <TherapistRow
                key={row.therapistId}
                name={row.therapistName}
                subtitle="Not yet"
                tone="warning"
              />
            ))
          ) : (
            <div className="rounded-xl border border-[var(--success-border)] bg-[var(--success-subtle)] px-4 py-4 text-sm text-[var(--success-text)]">
              Everyone has responded. You can move forward with schedule planning.
            </div>
          )}
        </div>

        <div className={cn('space-y-2', activeTab !== 'submitted' && 'hidden')}>
          <p className="px-1 pt-1 text-[11px] font-medium text-muted-foreground">
            {submittedRows.length > 0
              ? `${pluralizeTherapists(submittedRows.length)} have already submitted`
              : 'No submissions yet for this cycle.'}
          </p>

          {submittedRows.length > 0 ? (
            submittedRows.map((row) => (
              <TherapistRow
                key={row.therapistId}
                name={row.therapistName}
                subtitle={
                  (row.overridesCount ?? 0) > 0
                    ? `${row.overridesCount} saved date${row.overridesCount === 1 ? '' : 's'}`
                    : 'Submitted'
                }
                tone="success"
              />
            ))
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
              No one has submitted availability for this cycle yet.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
