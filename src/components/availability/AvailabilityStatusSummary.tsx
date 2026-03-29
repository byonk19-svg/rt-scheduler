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
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-[11px] font-bold uppercase text-slate-600">
        {name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              tone === 'warning' ? 'bg-orange-400' : 'bg-emerald-500'
            )}
          />
          <span className="text-[11px] font-medium text-slate-500">{subtitle}</span>
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

  return (
    <section className="flex h-full flex-col" aria-labelledby="availability-response-heading">
      <div className="border-b border-slate-200/80 px-5 py-4">
        <h2
          id="availability-response-heading"
          className="text-sm font-bold tracking-[-0.01em] text-slate-700"
        >
          Response roster
        </h2>
      </div>

      <div className="grid grid-cols-2 border-b border-slate-200/80 bg-slate-50/70">
        <button
          type="button"
          className={cn(
            'border-b-2 px-4 py-3 text-left text-xs font-bold transition-colors',
            activeTab === 'missing'
              ? 'border-orange-400 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          )}
          onClick={() => setActiveTab('missing')}
        >
          Not submitted yet{' '}
          <span className="ml-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700">
            {missingRows.length}
          </span>
        </button>
        <button
          type="button"
          className={cn(
            'border-b-2 px-4 py-3 text-left text-xs font-bold transition-colors',
            activeTab === 'submitted'
              ? 'border-emerald-400 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          )}
          onClick={() => setActiveTab('submitted')}
        >
          Submitted{' '}
          <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
            {submittedRows.length}
          </span>
        </button>
      </div>

      <div className="min-h-[25rem] flex-1 overflow-y-auto p-4">
        <div className={cn('space-y-3', activeTab !== 'missing' && 'hidden')}>
          <p className="px-1 text-[11px] font-medium text-slate-500">
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
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
              Everyone has responded. You can move forward with schedule planning.
            </div>
          )}
        </div>

        <div className={cn('space-y-3', activeTab !== 'submitted' && 'hidden')}>
          <p className="px-1 text-[11px] font-medium text-slate-500">
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
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              No one has submitted availability for this cycle yet.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
