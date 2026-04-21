'use client'

import { useState } from 'react'

import { EmailIntakeBatchCard } from '@/components/availability/EmailIntakeBatchCard'
import { Button } from '@/components/ui/button'

export type EmailIntakePanelItemRow = {
  id: string
  sourceType: 'body' | 'attachment'
  sourceLabel: string
  parseStatus: 'parsed' | 'auto_applied' | 'needs_review' | 'failed'
  confidenceLevel: 'high' | 'medium' | 'low'
  confidenceReasons: string[]
  extractedEmployeeName: string | null
  matchedTherapistId: string | null
  matchedTherapistName: string | null
  matchedCycleId: string | null
  matchedCycleLabel: string | null
  rawText?: string | null
  parsedRequests: Array<{
    date: string
    override_type: 'force_off' | 'force_on'
    shift_type: 'day' | 'night' | 'both'
  }>
  manuallyEdited?: boolean
}

export type EmailIntakePanelRow = {
  id: string
  fromEmail: string
  fromName: string | null
  subject: string | null
  receivedAt: string
  originalEmailText: string | null
  attachmentTexts: Array<{
    filename: string
    ocrText: string | null
    ocrStatus: 'not_run' | 'completed' | 'failed' | 'skipped'
  }>
  batchStatus: 'parsed' | 'needs_review' | 'failed' | 'applied'
  parseSummary: string | null
  itemCount: number
  autoAppliedCount: number
  needsReviewCount: number
  failedCount: number
  reviewItems: EmailIntakePanelItemRow[]
  autoAppliedItems: EmailIntakePanelItemRow[]
}

const HOW_IT_WORKS_STEPS = [
  'Forward request emails to your intake inbox',
  'Review items that still need matching',
  'Apply confirmed items one source at a time',
]

export function EmailIntakePanel({
  rows,
  applyEmailAvailabilityImportAction,
  updateEmailIntakeItemRequestAction,
  deleteEmailIntakeAction,
  reparseEmailIntakeAction,
  deleteAvailabilityEmailIntakeAction,
  reparseAvailabilityEmailIntakeAction,
  updateEmailIntakeTherapistAction,
  therapistOptions,
  cycleOptions,
}: {
  rows: EmailIntakePanelRow[]
  applyEmailAvailabilityImportAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true; cycleId: string; therapistId: string }>
  updateEmailIntakeItemRequestAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true }>
  deleteEmailIntakeAction?: (formData: FormData) => void | Promise<void>
  reparseEmailIntakeAction?: (formData: FormData) => void | Promise<void>
  deleteAvailabilityEmailIntakeAction?: (formData: FormData) => void | Promise<void>
  reparseAvailabilityEmailIntakeAction?: (formData: FormData) => void | Promise<void>
  updateEmailIntakeTherapistAction: (formData: FormData) => void | Promise<void>
  therapistOptions: Array<{ id: string; fullName: string }>
  cycleOptions: Array<{ id: string; label: string }>
}) {
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const runDeleteEmailIntakeAction = deleteEmailIntakeAction ?? deleteAvailabilityEmailIntakeAction
  const runReparseEmailIntakeAction =
    reparseEmailIntakeAction ?? reparseAvailabilityEmailIntakeAction

  return (
    <div>
      <div className="border-b border-border/70 pb-4">
        <h2 className="app-section-title">Email Intake</h2>
        <p className="text-sm text-muted-foreground">
          Forward staff request emails or forms into your intake inbox. Clear items can be
          auto-applied while unclear items stay in the review queue.
        </p>
        {rows.length > 0 ? (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowHowItWorks((current) => !current)}
            >
              How it works
            </Button>
            {showHowItWorks ? (
              <ol className="mt-2 flex flex-col gap-1.5 text-xs text-muted-foreground">
                {HOW_IT_WORKS_STEPS.map((step, i) => (
                  <li key={step} className="flex items-center gap-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground/70">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="space-y-4 pt-4">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
            <p>No intake items yet. Forward request emails to the intake inbox to begin.</p>
            <ol className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
              {HOW_IT_WORKS_STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground/70">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          rows.map((row) => (
            <EmailIntakeBatchCard
              key={row.id}
              row={row}
              applyEmailAvailabilityImportAction={applyEmailAvailabilityImportAction}
              updateEmailIntakeItemRequestAction={updateEmailIntakeItemRequestAction}
              updateEmailIntakeTherapistAction={updateEmailIntakeTherapistAction}
              deleteEmailIntakeAction={runDeleteEmailIntakeAction}
              reparseEmailIntakeAction={runReparseEmailIntakeAction}
              therapistOptions={therapistOptions}
              cycleOptions={cycleOptions}
            />
          ))
        )}
      </div>
    </div>
  )
}
