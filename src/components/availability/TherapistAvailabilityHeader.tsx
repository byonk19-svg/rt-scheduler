'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function TherapistAvailabilityHeader({
  actionButtons,
  availableCount,
  cannotWorkCount,
  cyclePageSubtitle,
  deadlinePresentation,
  hasUnsavedChanges,
  requestToWorkCount,
  submissionPrimaryLabel,
  submitted,
}: {
  actionButtons: ReactNode
  availableCount: number
  cannotWorkCount: number
  cyclePageSubtitle: string
  deadlinePresentation: {
    deadlineHeadline?: string | null
    emphasis?: 'past' | 'urgent' | 'neutral' | 'submitted'
    submittedPrimaryLine?: string | null
    submittedDeadlineContextLine?: string | null
  } | null
  hasUnsavedChanges: boolean
  requestToWorkCount: number
  submissionPrimaryLabel: string
  submitted: boolean
}) {
  return (
    <header className="border-b border-border/70 pb-4">
      <h1 className="font-heading text-[1.4rem] font-semibold leading-tight tracking-tight text-foreground">
        Availability for This Cycle
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{cyclePageSubtitle}</p>
      {deadlinePresentation ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2">
            <span
              className={cn(
                'w-fit shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold',
                submitted
                  ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
                  : 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
              )}
            >
              {submissionPrimaryLabel}
            </span>
            {!submitted && deadlinePresentation.deadlineHeadline ? (
              <p
                className={cn(
                  'min-w-0 text-base font-semibold leading-snug tracking-tight',
                  deadlinePresentation.emphasis === 'past' && 'text-[var(--error-text)]',
                  deadlinePresentation.emphasis === 'urgent' && 'text-[var(--warning-text)]',
                  deadlinePresentation.emphasis === 'neutral' && 'text-foreground'
                )}
              >
                {deadlinePresentation.deadlineHeadline}
              </p>
            ) : null}
            {submitted && deadlinePresentation.submittedPrimaryLine ? (
              <p className="min-w-0 text-base font-semibold leading-snug text-foreground">
                {deadlinePresentation.submittedPrimaryLine}
              </p>
            ) : null}
          </div>
          {submitted && deadlinePresentation.submittedDeadlineContextLine ? (
            <p className="text-sm font-medium text-muted-foreground">
              {deadlinePresentation.submittedDeadlineContextLine}
            </p>
          ) : null}
        </div>
      ) : null}
      {submitted && hasUnsavedChanges ? (
        <p className="mt-2 text-xs font-medium text-[var(--warning-text)]">
          You have unsaved changes - save to update your submitted availability.
        </p>
      ) : null}
      {!submitted && hasUnsavedChanges ? (
        <p className="mt-2 text-xs font-medium text-[var(--warning-text)]">
          You have unsaved changes. Save progress or submit availability.
        </p>
      ) : null}
      <p className="mt-2 text-xs tabular-nums text-muted-foreground">
        Availability summary: {availableCount} available · {cannotWorkCount} need off ·{' '}
        {requestToWorkCount} request to work
      </p>
      <ol className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
        {[
          'Tap each date to set Available, Need Off, or Request to Work',
          'Use Save progress when you are not ready to finalize',
          'Use Submit availability when this cycle is complete',
        ].map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground/70">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <div className="mt-4">{actionButtons}</div>
    </header>
  )
}
