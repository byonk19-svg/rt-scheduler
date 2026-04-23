'use client'

import { EmailIntakeBatchHeader } from '@/components/availability/EmailIntakeBatchHeader'
import { EmailIntakeItemSection } from '@/components/availability/EmailIntakeItemSection'
import { EmailIntakeOriginalSourcePanel } from '@/components/availability/EmailIntakeOriginalSourcePanel'
import type { EmailIntakePanelRow } from '@/components/availability/EmailIntakePanel'

type EmailIntakeBatchCardProps = {
  row: EmailIntakePanelRow
  applyEmailAvailabilityImportAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true; cycleId: string; therapistId: string }>
  updateEmailIntakeItemRequestAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true }>
  updateEmailIntakeTherapistAction: (formData: FormData) => void | Promise<void>
  deleteEmailIntakeAction?: (formData: FormData) => void | Promise<void>
  reparseEmailIntakeAction?: (formData: FormData) => void | Promise<void>
  therapistOptions: Array<{ id: string; fullName: string }>
  cycleOptions: Array<{ id: string; label: string }>
}

export function EmailIntakeBatchCard({
  row,
  applyEmailAvailabilityImportAction,
  updateEmailIntakeItemRequestAction,
  updateEmailIntakeTherapistAction,
  deleteEmailIntakeAction,
  reparseEmailIntakeAction,
  therapistOptions,
  cycleOptions,
}: EmailIntakeBatchCardProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/70 p-4 shadow-tw-sm">
      <EmailIntakeBatchHeader
        row={row}
        deleteEmailIntakeAction={deleteEmailIntakeAction}
        reparseEmailIntakeAction={reparseEmailIntakeAction}
      />

      {row.parseSummary ? (
        <p className="mt-3 text-sm text-muted-foreground">{row.parseSummary}</p>
      ) : null}

      <EmailIntakeOriginalSourcePanel
        originalEmailText={row.originalEmailText}
        attachmentTexts={row.attachmentTexts}
      />

      <EmailIntakeItemSection
        title="Needs review"
        description="Match these items before applying them to availability."
        items={row.reviewItems}
        applyEmailAvailabilityImportAction={applyEmailAvailabilityImportAction}
        cycleOptions={cycleOptions}
        therapistOptions={therapistOptions}
        updateEmailIntakeItemRequestAction={updateEmailIntakeItemRequestAction}
        updateEmailIntakeTherapistAction={updateEmailIntakeTherapistAction}
      />

      <EmailIntakeItemSection
        title="Auto-applied"
        summaryLabel={`${row.autoAppliedCount} auto-applied - show`}
        items={row.autoAppliedItems}
        applyEmailAvailabilityImportAction={applyEmailAvailabilityImportAction}
        cycleOptions={cycleOptions}
        therapistOptions={therapistOptions}
        updateEmailIntakeItemRequestAction={updateEmailIntakeItemRequestAction}
        updateEmailIntakeTherapistAction={updateEmailIntakeTherapistAction}
        collapsible
      />
    </div>
  )
}
