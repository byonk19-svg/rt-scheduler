import type { EmailIntakePanelRow } from '@/components/availability/EmailIntakePanel'

export type ToastVariant = 'success' | 'error'

export type AvailabilityPageSearchParams = {
  cycle?: string | string[]
  copied?: string | string[]
  error?: string | string[]
  success?: string | string[]
  tab?: string | string[]
  therapist?: string | string[]
}

export type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
  archived_at?: string | null
  availability_due_at?: string | null
}

export type ManagerPlannerTherapistRow = {
  id: string
  full_name: string
}

export type AvailabilityEmailIntakeRow = {
  id: string
  from_email: string
  from_name: string | null
  subject: string | null
  received_at: string
  text_content: string | null
  parse_status: 'parsed' | 'needs_review' | 'failed' | 'applied'
  batch_status: 'parsed' | 'needs_review' | 'failed' | 'applied'
  parse_summary: string | null
  item_count: number
  auto_applied_count: number
  needs_review_count: number
  failed_count: number
}

export type AvailabilityEmailAttachmentRow = {
  id: string
  intake_id: string
  filename: string
  ocr_text: string | null
  ocr_status: 'not_run' | 'completed' | 'failed' | 'skipped'
}

export type AvailabilityEmailIntakeItemRow = {
  id: string
  intake_id: string
  source_type: 'body' | 'attachment'
  source_label: string
  parse_status: 'parsed' | 'auto_applied' | 'needs_review' | 'failed'
  confidence_level: 'high' | 'medium' | 'low'
  confidence_reasons: string[] | null
  extracted_employee_name: string | null
  matched_therapist_id: string | null
  matched_cycle_id: string | null
  raw_text: string | null
  parsed_requests: Array<{
    date: string
    override_type: 'force_off' | 'force_on'
    shift_type: 'day' | 'night' | 'both'
  }> | null
  manually_edited_at?: string | null
  profiles: { full_name: string } | { full_name: string }[] | null
  schedule_cycles:
    | { label: string; start_date: string; end_date: string }
    | { label: string; start_date: string; end_date: string }[]
    | null
}

export function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export function toSearchString(params?: AvailabilityPageSearchParams): string {
  if (!params) return ''

  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (key === 'tab' || value == null) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, item)
      }
      continue
    }
    searchParams.set(key, value)
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export function getAvailabilityFeedback(params?: AvailabilityPageSearchParams): {
  message: string
  variant: ToastVariant
} | null {
  const error = getSearchParam(params?.error)
  const success = getSearchParam(params?.success)

  if (success === 'email_intake_applied') {
    return {
      message: 'Intake dates applied to availability.',
      variant: 'success',
    }
  }

  if (success === 'email_intake_match_saved') {
    return {
      message: 'Matches saved. Apply dates when ready.',
      variant: 'success',
    }
  }

  if (error === 'email_intake_apply_failed') {
    return {
      message: "Couldn't apply this request. Review the matched dates first.",
      variant: 'error',
    }
  }

  if (error === 'email_intake_match_failed') {
    return {
      message: "Couldn't save that match. Try again.",
      variant: 'error',
    }
  }

  return null
}

export function stripStoredEmailSubject(
  text: string | null,
  subject: string | null
): string | null {
  const normalizedText = text?.trim() ?? ''
  if (!normalizedText) return null

  const normalizedSubject = subject?.trim() ?? ''
  if (
    normalizedSubject &&
    normalizedText.startsWith(normalizedSubject) &&
    normalizedText.charAt(normalizedSubject.length) === '\n'
  ) {
    return normalizedText.slice(normalizedSubject.length).trim()
  }

  return normalizedText
}

export function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function selectAvailabilityIntakeCycle(
  cycles: Cycle[],
  selectedCycleIdFromParams: string | undefined
): Cycle | null {
  return (
    cycles.find((cycle) => cycle.id === selectedCycleIdFromParams) ??
    cycles.find((cycle) => cycle.published === false) ??
    cycles[0] ??
    null
  )
}

export function buildEmailIntakePanelRows({
  attachments,
  intakeRows,
  items,
}: {
  attachments: AvailabilityEmailAttachmentRow[]
  intakeRows: AvailabilityEmailIntakeRow[]
  items: AvailabilityEmailIntakeItemRow[]
}): EmailIntakePanelRow[] {
  const itemsByIntakeId = new Map<string, AvailabilityEmailIntakeItemRow[]>()
  for (const item of items) {
    const current = itemsByIntakeId.get(item.intake_id) ?? []
    current.push(item)
    itemsByIntakeId.set(item.intake_id, current)
  }

  const attachmentsByIntakeId = new Map<string, AvailabilityEmailAttachmentRow[]>()
  for (const attachment of attachments) {
    const current = attachmentsByIntakeId.get(attachment.intake_id) ?? []
    current.push(attachment)
    attachmentsByIntakeId.set(attachment.intake_id, current)
  }

  return intakeRows.map((row) => {
    const childItems = itemsByIntakeId.get(row.id) ?? []
    const intakeAttachments = attachmentsByIntakeId.get(row.id) ?? []

    return {
      id: row.id,
      fromEmail: row.from_email,
      fromName: row.from_name,
      subject: row.subject,
      receivedAt: row.received_at,
      originalEmailText: stripStoredEmailSubject(row.text_content, row.subject),
      attachmentTexts: intakeAttachments.map((attachment) => ({
        filename: attachment.filename,
        ocrText: attachment.ocr_text,
        ocrStatus: attachment.ocr_status,
      })),
      batchStatus: row.batch_status ?? row.parse_status,
      parseSummary: row.parse_summary,
      itemCount: row.item_count,
      autoAppliedCount: row.auto_applied_count,
      needsReviewCount: row.needs_review_count,
      failedCount: row.failed_count,
      reviewItems: childItems
        .filter((item) => item.parse_status !== 'auto_applied')
        .map((item) => {
          const matchedTherapist = getOne(item.profiles)
          const matchedCycle = getOne(item.schedule_cycles)
          return {
            id: item.id,
            sourceType: item.source_type,
            sourceLabel: item.source_label,
            parseStatus: item.parse_status,
            confidenceLevel: item.confidence_level,
            confidenceReasons: Array.isArray(item.confidence_reasons)
              ? item.confidence_reasons
              : [],
            extractedEmployeeName: item.extracted_employee_name,
            matchedTherapistId: item.matched_therapist_id,
            matchedTherapistName: matchedTherapist?.full_name ?? null,
            matchedCycleId: item.matched_cycle_id,
            matchedCycleLabel: matchedCycle
              ? `${matchedCycle.label} (${matchedCycle.start_date} to ${matchedCycle.end_date})`
              : null,
            rawText: item.raw_text,
            parsedRequests: Array.isArray(item.parsed_requests) ? item.parsed_requests : [],
            manuallyEdited: Boolean(item.manually_edited_at),
          }
        }),
      autoAppliedItems: childItems
        .filter((item) => item.parse_status === 'auto_applied')
        .map((item) => {
          const matchedTherapist = getOne(item.profiles)
          const matchedCycle = getOne(item.schedule_cycles)
          return {
            id: item.id,
            sourceType: item.source_type,
            sourceLabel: item.source_label,
            parseStatus: item.parse_status,
            confidenceLevel: item.confidence_level,
            confidenceReasons: Array.isArray(item.confidence_reasons)
              ? item.confidence_reasons
              : [],
            extractedEmployeeName: item.extracted_employee_name,
            matchedTherapistId: item.matched_therapist_id,
            matchedTherapistName: matchedTherapist?.full_name ?? null,
            matchedCycleId: item.matched_cycle_id,
            matchedCycleLabel: matchedCycle
              ? `${matchedCycle.label} (${matchedCycle.start_date} to ${matchedCycle.end_date})`
              : null,
            rawText: item.raw_text,
            parsedRequests: Array.isArray(item.parsed_requests) ? item.parsed_requests : [],
            manuallyEdited: Boolean(item.manually_edited_at),
          }
        }),
    }
  })
}
