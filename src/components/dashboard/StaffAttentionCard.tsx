import Link from 'next/link'

import { Button } from '@/components/ui/button'
import type {
  TherapistAvailabilityDueStatus,
  TherapistSubmissionUiState,
} from '@/lib/therapist-availability-submission'
import type { TherapistWorkflowModel, TherapistWorkflowState } from '@/lib/therapist-workflow'
import { cn } from '@/lib/utils'

function badgeToneClasses(state: TherapistWorkflowState): string {
  switch (state) {
    case 'published_schedule_available':
    case 'availability_submitted':
      return 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
    case 'preliminary_review_available':
      return 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
    case 'availability_draft':
    case 'availability_not_started':
      return 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
    default:
      return 'border-border/70 bg-muted/20 text-foreground'
  }
}

function dueChipToneClasses(tone: TherapistAvailabilityDueStatus['tone']): string {
  switch (tone) {
    case 'urgent':
      return 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
    case 'past':
      return 'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]'
    case 'muted':
      return 'border-border/70 bg-muted/20 text-muted-foreground'
    default:
      return 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
  }
}

function attentionCardClasses(
  state: TherapistWorkflowState,
  dueTone: TherapistAvailabilityDueStatus['tone'] | null
): string {
  if (state === 'availability_submitted') {
    return 'border-[var(--success-border)]/60 bg-[color:color-mix(in_srgb,var(--success-subtle)_28%,white)]'
  }
  if (dueTone === 'past') {
    return 'border-[var(--error-border)]/60 bg-[color:color-mix(in_srgb,var(--error-subtle)_22%,white)]'
  }
  if (dueTone === 'urgent') {
    return 'border-[var(--warning-border)]/60 bg-[color:color-mix(in_srgb,var(--warning-subtle)_24%,white)]'
  }
  return 'border-border bg-card'
}

type StaffAttentionCardProps = {
  workflow: TherapistWorkflowModel
  submissionUi: TherapistSubmissionUiState
  availabilityDueStatus: TherapistAvailabilityDueStatus | null
  availabilityDueLine: string | null
  workflowAlreadyLinksToSchedule: boolean
}

export function StaffAttentionCard({
  workflow,
  submissionUi,
  availabilityDueStatus,
  availabilityDueLine,
  workflowAlreadyLinksToSchedule,
}: StaffAttentionCardProps) {
  return (
    <article
      className={cn(
        'rounded-2xl border px-5 py-5 shadow-tw-sm',
        attentionCardClasses(workflow.state, availabilityDueStatus?.tone ?? null)
      )}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        What needs your attention now
      </div>
      <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
        {workflow.primaryTitle}
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
            badgeToneClasses(workflow.state)
          )}
        >
          {workflow.stateLabel}
        </span>
        {availabilityDueStatus ? (
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
              dueChipToneClasses(availabilityDueStatus.tone)
            )}
          >
            {availabilityDueStatus.label}
          </span>
        ) : null}
      </div>
      {workflow.cycleLabel && workflow.cycleRangeLabel ? (
        <div className="mt-3 rounded-xl border border-border/70 bg-background/65 px-3 py-3">
          <p className="text-sm font-semibold text-foreground">{workflow.cycleLabel}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{workflow.cycleRangeLabel}</p>
          {workflow.cycleReason ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{workflow.cycleReason}</p>
          ) : null}
        </div>
      ) : null}
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{workflow.primaryDescription}</p>
      {submissionUi.isSubmitted && submissionUi.submittedAtDisplay ? (
        <div className="mt-4 rounded-xl border border-[var(--success-border)] bg-[var(--success-subtle)]/55 px-3.5 py-3">
          <p className="text-sm font-semibold text-[var(--success-text)]">
            Submitted {submissionUi.submittedAtDisplay}
          </p>
          {submissionUi.lastEditedDisplay ? (
            <p className="mt-1 text-sm text-[var(--success-text)]/85">
              Updated after you sent it {submissionUi.lastEditedDisplay}
            </p>
          ) : null}
        </div>
      ) : null}
      {!submissionUi.isSubmitted && availabilityDueLine === 'No deadline set' ? (
        <p className="mt-3 text-sm text-muted-foreground">
          We will show the due date here once it is posted.
        </p>
      ) : null}
      <div className="mt-5 space-y-3">
        <Button asChild size="sm" className="min-h-10 px-4 sm:min-w-[15rem]">
          <Link href={workflow.primaryAction.href}>{workflow.primaryAction.label}</Link>
        </Button>
        {workflow.secondaryAction || !workflowAlreadyLinksToSchedule ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Need something else?
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {workflow.secondaryAction ? (
                <Link
                  href={workflow.secondaryAction.href}
                  className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {workflow.secondaryAction.label}
                </Link>
              ) : null}
              {!workflowAlreadyLinksToSchedule ? (
                <Link
                  href="/schedule"
                  className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  View schedule
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export { badgeToneClasses, dueChipToneClasses }
