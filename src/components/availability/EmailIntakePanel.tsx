import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type EmailIntakeAttachmentRow = {
  filename: string
  download_status: 'stored' | 'skipped' | 'failed'
  ocr_status: 'not_run' | 'completed' | 'failed' | 'skipped'
}

export type EmailIntakePanelRow = {
  id: string
  fromEmail: string
  fromName: string | null
  subject: string | null
  receivedAt: string
  parseStatus: 'parsed' | 'needs_review' | 'failed' | 'applied'
  parseSummary: string | null
  matchedTherapistId: string | null
  matchedTherapistName: string | null
  matchedCycleLabel: string | null
  parsedRequests: Array<{
    date: string
    override_type: 'force_off' | 'force_on'
  }>
  attachments: EmailIntakeAttachmentRow[]
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
  status: EmailIntakePanelRow['parseStatus']
): 'outline' | 'secondary' | 'destructive' | 'default' {
  if (status === 'applied') return 'secondary'
  if (status === 'parsed') return 'default'
  if (status === 'failed') return 'destructive'
  return 'outline'
}

function formatRequestLabel(request: EmailIntakePanelRow['parsedRequests'][number]): string {
  const parsed = new Date(`${request.date}T00:00:00`)
  const label = Number.isNaN(parsed.getTime())
    ? request.date
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${label} ${request.override_type === 'force_off' ? 'off' : 'work'}`
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
          Forward staff request emails or forms into your intake inbox, then review and apply parsed
          dates into availability planning.
        </CardDescription>
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
            No inbound request emails yet.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-border/70 bg-card/70 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
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
                    <Badge variant={formatStatusVariant(row.parseStatus)}>{row.parseStatus}</Badge>
                  </div>
                  <p className="text-sm text-foreground">{row.subject ?? 'No subject'}</p>
                  <p className="text-xs text-muted-foreground">
                    Received {formatDateTime(row.receivedAt)}
                  </p>
                </div>

                {row.matchedTherapistId && row.parsedRequests.length > 0 ? (
                  <form action={applyEmailAvailabilityImportAction}>
                    <input type="hidden" name="intake_id" value={row.id} />
                    <Button size="sm" type="submit">
                      Apply dates
                    </Button>
                  </form>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Therapist:{' '}
                  <span className="font-medium text-foreground">
                    {row.matchedTherapistName ?? 'Needs match'}
                  </span>
                </span>
                <span className="text-border/90" aria-hidden="true">
                  /
                </span>
                <span>
                  Cycle:{' '}
                  <span className="font-medium text-foreground">
                    {row.matchedCycleLabel ?? 'Needs review'}
                  </span>
                </span>
                {row.attachments.length > 0 ? (
                  <>
                    <span className="text-border/90" aria-hidden="true">
                      /
                    </span>
                    <span>
                      Attachments:{' '}
                      <span className="font-medium text-foreground">{row.attachments.length}</span>
                    </span>
                  </>
                ) : null}
              </div>

              {!row.matchedTherapistId ? (
                <form
                  action={updateEmailIntakeTherapistAction}
                  className="mt-3 flex flex-wrap gap-3"
                >
                  <input type="hidden" name="intake_id" value={row.id} />
                  <div className="min-w-60 flex-1 space-y-1">
                    <Label htmlFor={`intake_match_${row.id}`}>Match therapist</Label>
                    <select
                      id={`intake_match_${row.id}`}
                      name="therapist_id"
                      required
                      defaultValue=""
                      className="border-input bg-[var(--input-background)] focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
                    >
                      <option value="" disabled>
                        Select therapist
                      </option>
                      {therapistOptions.map((option) => (
                        <option key={`${row.id}-${option.id}`} value={option.id}>
                          {option.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button size="sm" type="submit" variant="outline">
                      Save match
                    </Button>
                  </div>
                </form>
              ) : null}

              {row.parseSummary ? (
                <p className="mt-3 text-sm text-muted-foreground">{row.parseSummary}</p>
              ) : null}

              {row.parsedRequests.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.parsedRequests.map((request) => (
                    <Badge
                      key={`${row.id}-${request.date}-${request.override_type}`}
                      variant="outline"
                    >
                      {formatRequestLabel(request)}
                    </Badge>
                  ))}
                </div>
              ) : null}

              {row.attachments.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {row.attachments.map((attachment) => (
                    <span
                      key={`${row.id}-${attachment.filename}`}
                      className="rounded-md border border-border/70 bg-muted/20 px-2 py-1"
                    >
                      {attachment.filename} ({attachment.download_status}, OCR{' '}
                      {attachment.ocr_status})
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
