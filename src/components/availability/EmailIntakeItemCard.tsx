'use client'

import { EmailIntakeItemSummary } from '@/components/availability/EmailIntakeItemSummary'
import { EmailIntakeMatchForm } from '@/components/availability/EmailIntakeMatchForm'
import { EmailIntakeRequestChipList } from '@/components/availability/EmailIntakeRequestChipList'

import type { EmailIntakePanelItemRow } from '@/components/availability/EmailIntakePanel'

export function EmailIntakeItemCard({
  item,
  applyEmailAvailabilityImportAction,
  cycleOptions,
  therapistOptions,
  updateEmailIntakeItemRequestAction,
  updateEmailIntakeTherapistAction,
}: {
  item: EmailIntakePanelItemRow
  applyEmailAvailabilityImportAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true; cycleId: string; therapistId: string }>
  cycleOptions: Array<{ id: string; label: string }>
  therapistOptions: Array<{ id: string; fullName: string }>
  updateEmailIntakeItemRequestAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true }>
  updateEmailIntakeTherapistAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <div key={item.id} className="rounded-lg border border-border/70 bg-muted/10 p-3">
      <EmailIntakeItemSummary
        item={item}
        applyEmailAvailabilityImportAction={applyEmailAvailabilityImportAction}
      />

      <EmailIntakeRequestChipList
        item={item}
        updateEmailIntakeItemRequestAction={updateEmailIntakeItemRequestAction}
      />

      {(!item.matchedTherapistId || !item.matchedCycleId) && item.parseStatus !== 'auto_applied' ? (
        <EmailIntakeMatchForm
          cycleOptions={cycleOptions}
          item={item}
          therapistOptions={therapistOptions}
          updateEmailIntakeTherapistAction={updateEmailIntakeTherapistAction}
        />
      ) : null}

      {item.rawText?.trim() ? (
        <details className="mt-3 rounded-md border border-border/70 bg-background/80">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground">
            Show source text
          </summary>
          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap border-t border-border/70 px-3 py-2 text-xs font-mono text-foreground">
            {item.rawText}
          </pre>
        </details>
      ) : null}
    </div>
  )
}
