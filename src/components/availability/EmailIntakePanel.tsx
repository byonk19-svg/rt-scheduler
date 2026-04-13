import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  parsedRequests: Array<{
    date: string
    override_type: 'force_off' | 'force_on'
  }>
}

export type EmailIntakePanelRow = {
  id: string
  fromEmail: string
  fromName: string | null
  subject: string | null
  receivedAt: string
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
  return `${label} ${request.override_type === 'force_off' ? 'off' : 'work'}`
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
  applyEmailAvailabilityImportAction: (formData: FormData) => void | Promise<void>
  updateEmailIntakeTherapistAction: (formData: FormData) => void | Promise<void>
  therapistOptions: Array<{ id: string; fullName: string }>
  cycleOptions: Array<{ id: string; label: string }>
}) {
  const {
    item,
    applyEmailAvailabilityImportAction,
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
          </div>
          <p className="text-xs text-muted-foreground">
            {item.extractedEmployeeName
              ? `Detected employee: ${item.extractedEmployeeName}`
              : 'Employee name not detected'}
          </p>
          <p className="text-xs text-muted-foreground">{getItemNextStep(item)}</p>
        </div>

        {item.matchedTherapistId && item.matchedCycleId && item.parsedRequests.length > 0 ? (
          <form action={applyEmailAvailabilityImportAction}>
            <input type="hidden" name="item_id" value={item.id} />
            <Button size="sm" type="submit">
              Apply item
            </Button>
          </form>
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

      {item.confidenceReasons.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.confidenceReasons.map((reason) => (
            <Badge key={`${item.id}-${reason}`} variant="outline">
              {reason}
            </Badge>
          ))}
        </div>
      ) : null}

      {(!item.matchedTherapistId || !item.matchedCycleId) && item.parseStatus !== 'auto_applied' ? (
        <form action={updateEmailIntakeTherapistAction} className="mt-3 flex flex-wrap gap-3">
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
            <Button size="sm" type="submit" variant="outline">
              Save matches
            </Button>
          </div>
        </form>
      ) : null}

      {item.parsedRequests.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.parsedRequests.map((request) => (
            <Badge key={`${item.id}-${request.date}-${request.override_type}`} variant="outline">
              {formatRequestLabel(request)}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function EmailIntakePanel({
  rows,
  applyEmailAvailabilityImportAction,
  createManualEmailIntakeAction,
  updateEmailIntakeTherapistAction,
  therapistOptions,
  cycleOptions,
}: {
  rows: EmailIntakePanelRow[]
  applyEmailAvailabilityImportAction: (formData: FormData) => void | Promise<void>
  createManualEmailIntakeAction: (formData: FormData) => void | Promise<void>
  updateEmailIntakeTherapistAction: (formData: FormData) => void | Promise<void>
  therapistOptions: Array<{ id: string; fullName: string }>
  cycleOptions: Array<{ id: string; label: string }>
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/70">
        <CardTitle>Email Intake</CardTitle>
        <CardDescription>
          Forward staff request emails or forms into your intake inbox. Clear items can be
          auto-applied while unclear items stay in the review queue.
        </CardDescription>
        <ol className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
          {[
            'Create an intake from pasted text or an uploaded form',
            'Review only the items that still need matching',
            'Apply unresolved items one source at a time',
          ].map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground/70">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <form
          action={createManualEmailIntakeAction}
          className="rounded-xl border border-border/70 bg-muted/15 p-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual_intake_therapist">Therapist</Label>
              <select
                id="manual_intake_therapist"
                name="therapist_id"
                required
                className="border-input bg-[var(--input-background)] focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
                defaultValue=""
              >
                <option value="" disabled>
                  Select therapist
                </option>
                {therapistOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual_intake_cycle">Schedule block</Label>
              <select
                id="manual_intake_cycle"
                name="cycle_id"
                required
                className="border-input bg-[var(--input-background)] focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
                defaultValue=""
              >
                <option value="" disabled>
                  Select schedule block
                </option>
                {cycleOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="manual_intake_source_email">Source email</Label>
              <Input
                id="manual_intake_source_email"
                name="source_email"
                type="email"
                placeholder="employee@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual_intake_subject">Subject</Label>
              <Input
                id="manual_intake_subject"
                name="subject"
                type="text"
                placeholder="Availability request"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="manual_intake_text">Paste request text</Label>
              <textarea
                id="manual_intake_text"
                name="pasted_text"
                rows={5}
                placeholder="Need off Apr 14, Apr 16&#10;Can work Apr 18"
                className="border-input bg-[var(--input-background)] focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual_intake_attachment">Upload form image or PDF</Label>
              <Input
                id="manual_intake_attachment"
                name="attachment"
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.gif,.pdf"
              />
              <p className="text-xs text-muted-foreground">
                Images can be OCR&apos;d automatically. PDFs are stored for review.
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button size="sm" type="submit">
              Create intake
            </Button>
          </div>
        </form>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
            No intake items yet. Create one above to start a reviewable batch.
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

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md border border-border/70 px-2 py-1">
                    {row.itemCount} items
                  </span>
                  <span className="rounded-md border border-border/70 px-2 py-1">
                    {row.autoAppliedCount} auto-applied
                  </span>
                  <span className="rounded-md border border-border/70 px-2 py-1">
                    {row.needsReviewCount} needs review
                  </span>
                  <span className="rounded-md border border-border/70 px-2 py-1">
                    {row.failedCount} failed
                  </span>
                </div>
              </div>

              {row.parseSummary ? (
                <p className="mt-3 text-sm text-muted-foreground">{row.parseSummary}</p>
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
                        updateEmailIntakeTherapistAction,
                        therapistOptions,
                        cycleOptions,
                      })
                    )}
                  </div>
                </div>
              ) : null}

              {row.autoAppliedItems.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Auto-applied recently</h3>
                    <span className="text-xs text-muted-foreground">
                      {row.autoAppliedItems.length} item
                      {row.autoAppliedItems.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.autoAppliedItems.map((item) => (
                      <Badge key={item.id} variant="secondary">
                        {item.sourceLabel}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
