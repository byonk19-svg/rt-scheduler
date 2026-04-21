'use client'

import { EmailIntakeItemCard } from '@/components/availability/EmailIntakeItemCard'
import type { EmailIntakePanelItemRow } from '@/components/availability/EmailIntakePanel'

type EmailIntakeItemSectionProps = {
  title: string
  description?: string
  summaryLabel?: string
  items: EmailIntakePanelItemRow[]
  applyEmailAvailabilityImportAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true; cycleId: string; therapistId: string }>
  updateEmailIntakeItemRequestAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true }>
  updateEmailIntakeTherapistAction: (formData: FormData) => void | Promise<void>
  therapistOptions: Array<{ id: string; fullName: string }>
  cycleOptions: Array<{ id: string; label: string }>
  collapsible?: boolean
}

export function EmailIntakeItemSection({
  title,
  description,
  summaryLabel,
  items,
  applyEmailAvailabilityImportAction,
  updateEmailIntakeItemRequestAction,
  updateEmailIntakeTherapistAction,
  therapistOptions,
  cycleOptions,
  collapsible = false,
}: EmailIntakeItemSectionProps) {
  if (items.length === 0) return null

  const content = (
    <div className="grid gap-3">
      {items.map((item) => (
        <EmailIntakeItemCard
          key={item.id}
          item={item}
          applyEmailAvailabilityImportAction={applyEmailAvailabilityImportAction}
          cycleOptions={cycleOptions}
          therapistOptions={therapistOptions}
          updateEmailIntakeItemRequestAction={updateEmailIntakeItemRequestAction}
          updateEmailIntakeTherapistAction={updateEmailIntakeTherapistAction}
        />
      ))}
    </div>
  )

  if (collapsible) {
    return (
      <details className="mt-4 rounded-lg border border-border/70 bg-muted/10">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-foreground">
          {summaryLabel ?? title}
        </summary>
        <div className="border-t border-border/70 px-3 py-3">{content}</div>
      </details>
    )
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {content}
    </div>
  )
}
