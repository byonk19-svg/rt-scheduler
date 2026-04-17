'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

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

function formatDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatStatusVariant(
  status: EmailIntakePanelRow['batchStatus'] | EmailIntakePanelItemRow['parseStatus']
): 'outline' | 'secondary' | 'destructive' | 'default' {
  if (status === 'applied' || status === 'auto_applied') return 'secondary'
  if (status === 'parsed') return 'default'
  if (status === 'failed') return 'destructive'
  return 'outline'
}

function formatRequestLabel(request: EmailIntakePanelItemRow['parsedRequests'][number]): string {
  const parsed = new Date(`${request.date}T00:00:00`)
  const label = Number.isNaN(parsed.getTime())
    ? request.date
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const shiftSuffix =
    request.shift_type === 'both' ? '' : request.shift_type === 'day' ? ' (day)' : ' (night)'
  return `${label} ${request.override_type === 'force_off' ? 'off' : 'work'}${shiftSuffix}`
}

const CONFIDENCE_REASON_LABELS: Record<string, string> = {
  employee_name_missing: 'Name not found',
  employee_match_ambiguous: 'Name match uncertain',
  cycle_match_missing: 'No schedule block matched',
  unresolved_lines_present: 'Unresolved text lines',
  low_request_count: 'Few dates found',
  name_match_ambiguous: 'Name match uncertain',
}

const HOW_IT_WORKS_STEPS = [
  'Forward request emails to your intake inbox',
  'Review items that still need matching',
  'Apply confirmed items one source at a time',
]

function statChipClass(
  type: 'review' | 'failed' | 'applied' | 'default',
  count: number
): string | null {
  if (count === 0) return null
  if (type === 'review') return 'border-warning-border bg-warning-subtle text-warning-text'
  if (type === 'failed') return 'border-destructive/40 bg-destructive/10 text-destructive'
  if (type === 'applied') return 'border-success-border bg-success-subtle text-success-text'
  return 'border-border/70'
}

function hasOriginalEmailContent(row: EmailIntakePanelRow): boolean {
  return (
    Boolean(row.originalEmailText?.trim()) ||
    row.attachmentTexts.some((attachment) => Boolean(attachment.ocrText?.trim()))
  )
}

function buildPostApplyAvailabilityHref(cycleId: string, therapistId: string) {
  const search = new URLSearchParams()
  search.set('tab', 'intake')
  search.set('success', 'email_intake_applied')
  search.set('cycle', cycleId)
  search.set('therapist', therapistId)
  search.set('roster', 'has_requests')
  return `/availability?${search.toString()}`
}

function EmailIntakeApplyDatesButton({
  item,
  applyEmailAvailabilityImportAction,
}: {
  item: EmailIntakePanelItemRow
  applyEmailAvailabilityImportAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true; cycleId: string; therapistId: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!item.matchedCycleId || !item.matchedTherapistId) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('item_id', item.id)
      const result = await applyEmailAvailabilityImportAction(fd)
      if (
        result &&
        typeof result === 'object' &&
        'ok' in result &&
        result.ok &&
        'cycleId' in result &&
        'therapistId' in result
      ) {
        router.replace(
          buildPostApplyAvailabilityHref(String(result.cycleId), String(result.therapistId))
        )
        router.refresh()
      }
    })
  }

  return (
    <Button type="button" size="sm" disabled={pending} aria-busy={pending} onClick={handleClick}>
      Apply dates
    </Button>
  )
}

function EmailIntakeRequestChipRow({
  item,
  request,
  updateEmailIntakeItemRequestAction,
}: {
  item: EmailIntakePanelItemRow
  request: EmailIntakePanelItemRow['parsedRequests'][number]
  updateEmailIntakeItemRequestAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function runAction(buildFormData: () => FormData) {
    startTransition(async () => {
      const fd = buildFormData()
      const result = await updateEmailIntakeItemRequestAction(fd)
      if (result && typeof result === 'object' && 'ok' in result && result.ok) {
        router.refresh()
      }
    })
  }

  function handleToggle() {
    runAction(() => {
      const fd = new FormData()
      fd.set('item_id', item.id)
      fd.set('date', request.date)
      fd.set('override_type', request.override_type)
      fd.set('shift_type', request.shift_type)
      return fd
    })
  }

  function handleRemove() {
    const label = formatRequestLabel(request)
    if (
      !window.confirm(
        `Remove ${label} from this item? To rebuild all parsed dates from the original message or attachment, use Reparse on the email.`
      )
    ) {
      return
    }
    runAction(() => {
      const fd = new FormData()
      fd.set('mode', 'remove')
      fd.set('item_id', item.id)
      fd.set('date', request.date)
      fd.set('override_type', request.override_type)
      fd.set('shift_type', request.shift_type)
      return fd
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-busy={pending}
        title="Switch between day off and available to work"
        onClick={handleToggle}
        className={
          request.override_type === 'force_off'
            ? 'h-7 border-destructive/30 bg-destructive/10 px-2 text-xs text-destructive hover:bg-destructive/15 hover:text-destructive'
            : 'h-7 border-info-border bg-info-subtle px-2 text-xs text-info-text hover:bg-info-subtle/80 hover:text-info-text'
        }
      >
        {formatRequestLabel(request)}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        aria-label={`Remove ${formatRequestLabel(request)} from parsed list`}
        onClick={handleRemove}
      >
        Remove
      </Button>
    </div>
  )
}

function getItemNextStep(item: EmailIntakePanelItemRow): string {
  if (item.parseStatus === 'auto_applied') {
    return 'Already auto-applied to availability.'
  }
  if (!item.matchedTherapistId || !item.matchedCycleId) {
    return 'Match the therapist and schedule block before applying this item.'
  }
  if (item.parsedRequests.length === 0) {
    return 'No parsed dates were found. Review the source text before applying.'
  }
  return 'Ready to apply as an availability override.'
}

function renderItemCard(params: {
  item: EmailIntakePanelItemRow
  applyEmailAvailabilityImportAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true; cycleId: string; therapistId: string }>
  updateEmailIntakeItemRequestAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true }>
  updateEmailIntakeTherapistAction: (formData: FormData) => void | Promise<void>
  therapistOptions: Array<{ id: string; fullName: string }>
  cycleOptions: Array<{ id: string; label: string }>
}) {
  const {
    item,
    applyEmailAvailabilityImportAction,
    updateEmailIntakeItemRequestAction,
    updateEmailIntakeTherapistAction,
    therapistOptions,
    cycleOptions,
  } = params

  return (
    <div key={item.id} className="rounded-lg border border-border/70 bg-muted/10 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{item.sourceLabel}</p>
            <Badge variant={formatStatusVariant(item.parseStatus)}>{item.parseStatus}</Badge>
            <Badge variant="outline">{item.confidenceLevel} confidence</Badge>
            {item.manuallyEdited ? <Badge variant="outline">Edited</Badge> : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {item.extractedEmployeeName
              ? `Detected employee: ${item.extractedEmployeeName}`
              : 'Employee name not detected'}
          </p>
          <p className="text-xs text-muted-foreground">{getItemNextStep(item)}</p>
        </div>

        {item.matchedTherapistId && item.matchedCycleId && item.parsedRequests.length > 0 ? (
          <EmailIntakeApplyDatesButton
            item={item}
            applyEmailAvailabilityImportAction={applyEmailAvailabilityImportAction}
          />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          Therapist:{' '}
          <span className="font-medium text-foreground">
            {item.matchedTherapistName ?? 'Needs match'}
          </span>
        </span>
        <span className="text-border/90" aria-hidden="true">
          /
        </span>
        <span>
          Cycle:{' '}
          <span className="font-medium text-foreground">
            {item.matchedCycleLabel ?? 'Needs review'}
          </span>
        </span>
      </div>

      {item.parsedRequests.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.parsedRequests.map((request) => (
            <EmailIntakeRequestChipRow
              key={`${item.id}-${request.date}-${request.override_type}-${request.shift_type}`}
              item={item}
              request={request}
              updateEmailIntakeItemRequestAction={updateEmailIntakeItemRequestAction}
            />
          ))}
        </div>
      ) : null}

      {item.confidenceReasons.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.confidenceReasons.map((reason) => (
            <Badge key={`${item.id}-${reason}`} variant="outline">
              {CONFIDENCE_REASON_LABELS[reason] ?? reason}
            </Badge>
          ))}
        </div>
      ) : null}

      {(!item.matchedTherapistId || !item.matchedCycleId) && item.parseStatus !== 'auto_applied' ? (
        <div className="mt-3 border-l-2 border-warning pl-3">
          <p className="mb-2 text-xs font-medium text-warning-text">Action needed</p>
          <form action={updateEmailIntakeTherapistAction} className="flex flex-wrap gap-3">
            <input type="hidden" name="item_id" value={item.id} />
            <div className="min-w-60 flex-1 space-y-1">
              <Label htmlFor={`item_match_${item.id}`}>Match therapist</Label>
              <select
                id={`item_match_${item.id}`}
                name="therapist_id"
                required
                defaultValue={item.matchedTherapistId ?? ''}
                className="border-input bg-[var(--input-background)] focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="" disabled>
                  Select therapist
                </option>
                {therapistOptions.map((option) => (
                  <option key={`${item.id}-${option.id}`} value={option.id}>
                    {option.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-60 flex-1 space-y-1">
              <Label htmlFor={`item_cycle_${item.id}`}>Match schedule block</Label>
              <select
                id={`item_cycle_${item.id}`}
                name="cycle_id"
                required
                defaultValue={item.matchedCycleId ?? ''}
                className="border-input bg-[var(--input-background)] focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="" disabled>
                  Select schedule block
                </option>
                {cycleOptions.map((option) => (
                  <option key={`${item.id}-${option.id}`} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button size="sm" type="submit">
                Save matches
              </Button>
            </div>
          </form>
        </div>
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
            <div
              key={row.id}
              className="rounded-xl border border-border/70 bg-card/70 p-4 shadow-tw-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">
                      {row.fromName ? `${row.fromName} ` : ''}
                      <span className="text-sm font-normal text-muted-foreground">
                        {row.fromEmail}
                      </span>
                    </p>
                    <Badge variant={formatStatusVariant(row.batchStatus)}>{row.batchStatus}</Badge>
                  </div>
                  <p className="text-sm text-foreground">{row.subject ?? 'No subject'}</p>
                  <p className="text-xs text-muted-foreground">
                    Received {formatDateTime(row.receivedAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex flex-wrap justify-end gap-2 text-xs text-muted-foreground">
                    {[
                      {
                        label: `${row.itemCount} items`,
                        className: statChipClass('default', row.itemCount),
                      },
                      {
                        label: `${row.autoAppliedCount} auto-applied`,
                        className: statChipClass('applied', row.autoAppliedCount),
                      },
                      {
                        label: `${row.needsReviewCount} needs review`,
                        className: statChipClass('review', row.needsReviewCount),
                      },
                      {
                        label: `${row.failedCount} failed`,
                        className: statChipClass('failed', row.failedCount),
                      },
                    ]
                      .filter((chip) => chip.className)
                      .map((chip) => (
                        <span
                          key={`${row.id}-${chip.label}`}
                          className={`rounded-md border px-2 py-1 ${chip.className}`}
                        >
                          {chip.label}
                        </span>
                      ))}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <form action={runReparseEmailIntakeAction}>
                      <input type="hidden" name="intake_id" value={row.id} />
                      <Button size="sm" type="submit" variant="outline">
                        Reparse
                      </Button>
                    </form>
                    <form action={runDeleteEmailIntakeAction}>
                      <input type="hidden" name="intake_id" value={row.id} />
                      <Button size="sm" type="submit" variant="destructive">
                        Delete
                      </Button>
                    </form>
                  </div>
                </div>
              </div>

              {row.parseSummary ? (
                <p className="mt-3 text-sm text-muted-foreground">{row.parseSummary}</p>
              ) : null}

              {hasOriginalEmailContent(row) ? (
                <details className="mt-4 rounded-lg border border-border/70 bg-muted/10">
                  <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-foreground">
                    View original email
                  </summary>
                  <div className="space-y-4 border-t border-border/70 px-3 py-3">
                    {row.originalEmailText ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Email body
                        </p>
                        <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-background/80 p-3 text-xs text-foreground">
                          {row.originalEmailText}
                        </pre>
                      </div>
                    ) : null}
                    {row.attachmentTexts.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Attachment OCR
                        </p>
                        <div className="space-y-2">
                          {row.attachmentTexts.map((attachment) => (
                            <div
                              key={`${row.id}-${attachment.filename}`}
                              className="rounded-md border border-border/70 bg-background/70 p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-foreground">
                                  {attachment.filename}
                                </p>
                                <Badge variant="outline">{attachment.ocrStatus}</Badge>
                              </div>
                              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-foreground">
                                {attachment.ocrText?.trim() ||
                                  'No OCR text stored for this attachment.'}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </details>
              ) : null}

              {row.reviewItems.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Needs review</h3>
                    <span className="text-xs text-muted-foreground">
                      {row.reviewItems.length} item{row.reviewItems.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {row.reviewItems.map((item) =>
                      renderItemCard({
                        item,
                        applyEmailAvailabilityImportAction,
                        updateEmailIntakeItemRequestAction,
                        updateEmailIntakeTherapistAction,
                        therapistOptions,
                        cycleOptions,
                      })
                    )}
                  </div>
                </div>
              ) : null}

              {row.autoAppliedItems.length > 0 ? (
                <details className="mt-4 rounded-lg border border-border/70 bg-muted/10 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">
                    {row.autoAppliedItems.length} auto-applied - show
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.autoAppliedItems.map((item) => (
                      <Badge key={item.id} variant="secondary">
                        {item.sourceLabel}
                      </Badge>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
