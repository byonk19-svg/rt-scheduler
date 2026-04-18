import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Download } from 'lucide-react'

import {
  applyEmailAvailabilityImportAction,
  deleteEmailIntakeAction,
  reparseEmailIntakeAction,
  updateEmailIntakeItemRequestAction,
  updateEmailIntakeTherapistAction,
} from '@/app/availability/actions'
import {
  EmailIntakePanel,
  type EmailIntakePanelRow,
} from '@/components/availability/EmailIntakePanel'
import { AvailabilityOverviewHeader } from '@/components/availability/AvailabilityOverviewHeader'
import { FeedbackToast } from '@/components/feedback-toast'
import { MoreActionsMenu } from '@/components/more-actions-menu'
import { PrintMenuItem } from '@/components/print-menu-item'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import { formatHumanCycleRange } from '@/lib/calendar-utils'
import { toUiRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error'
type AvailabilityPageSearchParams = {
  cycle?: string | string[]
  copied?: string | string[]
  error?: string | string[]
  success?: string | string[]
  tab?: string | string[]
  therapist?: string | string[]
}

type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
  archived_at?: string | null
  availability_due_at?: string | null
}

type ManagerPlannerTherapistRow = {
  id: string
  full_name: string
}

type AvailabilityEmailIntakeRow = {
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

type AvailabilityEmailAttachmentRow = {
  id: string
  intake_id: string
  filename: string
  ocr_text: string | null
  ocr_status: 'not_run' | 'completed' | 'failed' | 'skipped'
}

type AvailabilityEmailIntakeItemRow = {
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

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function toSearchString(params?: AvailabilityPageSearchParams): string {
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

function getAvailabilityFeedback(params?: AvailabilityPageSearchParams): {
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

function stripStoredEmailSubject(text: string | null, subject: string | null): string | null {
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

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function AvailabilityIntakePage({
  searchParams,
}: {
  searchParams?: Promise<AvailabilityPageSearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = searchParams ? await searchParams : undefined
  if (getSearchParam(params?.tab) === 'planner') {
    redirect(`/availability${toSearchString(params)}`)
  }

  const feedback = getAvailabilityFeedback(params)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = toUiRole(profile?.role)
  if (!can(role, 'access_manager_ui')) {
    redirect(`/therapist/availability${toSearchString(params)}`)
  }

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [cyclesResult, plannerTherapistsResult, emailIntakesResult] = await Promise.all([
    supabase
      .from('schedule_cycles')
      .select('id, label, start_date, end_date, published, archived_at, availability_due_at')
      .is('archived_at', null)
      .gte('end_date', todayKey)
      .order('start_date', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['therapist', 'lead'])
      .eq('is_active', true)
      .is('archived_at', null)
      .order('full_name', { ascending: true }),
    supabase
      .from('availability_email_intakes')
      .select(
        'id, from_email, from_name, subject, received_at, text_content, parse_status, batch_status, parse_summary, item_count, auto_applied_count, needs_review_count, failed_count'
      )
      .order('received_at', { ascending: false })
      .limit(12),
  ])

  const cycles = (cyclesResult.data ?? []) as Cycle[]
  const selectedCycleIdFromParams = getSearchParam(params?.cycle)
  const selectedCycle =
    cycles.find((cycle) => cycle.id === selectedCycleIdFromParams) ??
    cycles.find((cycle) => cycle.published === false) ??
    cycles[0] ??
    null

  const rawEmailIntakeRows = (emailIntakesResult.data ?? []) as AvailabilityEmailIntakeRow[]
  const emailIntakeIds = rawEmailIntakeRows.map((row) => row.id)

  const [emailItemResult, emailAttachmentResult] =
    emailIntakeIds.length > 0
      ? await Promise.all([
          supabase
            .from('availability_email_intake_items')
            .select(
              'id, intake_id, source_type, source_label, parse_status, confidence_level, confidence_reasons, extracted_employee_name, matched_therapist_id, matched_cycle_id, raw_text, parsed_requests, manually_edited_at, profiles!availability_email_intake_items_matched_therapist_id_fkey(full_name), schedule_cycles(label, start_date, end_date)'
            )
            .in('intake_id', emailIntakeIds),
          supabase
            .from('availability_email_attachments')
            .select('id, intake_id, filename, ocr_text, ocr_status')
            .in('intake_id', emailIntakeIds),
        ])
      : [{ data: [] }, { data: [] }]

  const emailItemRows = (emailItemResult.data ?? []) as AvailabilityEmailIntakeItemRow[]
  const emailAttachmentRows = (emailAttachmentResult.data ?? []) as AvailabilityEmailAttachmentRow[]
  const plannerTherapists = (plannerTherapistsResult.data ?? []) as ManagerPlannerTherapistRow[]

  const itemsByIntakeId = new Map<string, AvailabilityEmailIntakeItemRow[]>()
  for (const item of emailItemRows) {
    const current = itemsByIntakeId.get(item.intake_id) ?? []
    current.push(item)
    itemsByIntakeId.set(item.intake_id, current)
  }
  const attachmentsByIntakeId = new Map<string, AvailabilityEmailAttachmentRow[]>()
  for (const attachment of emailAttachmentRows) {
    const current = attachmentsByIntakeId.get(attachment.intake_id) ?? []
    current.push(attachment)
    attachmentsByIntakeId.set(attachment.intake_id, current)
  }

  const emailIntakeRows: EmailIntakePanelRow[] = rawEmailIntakeRows.map((row) => {
    const childItems = itemsByIntakeId.get(row.id) ?? []
    const attachments = attachmentsByIntakeId.get(row.id) ?? []

    return {
      id: row.id,
      fromEmail: row.from_email,
      fromName: row.from_name,
      subject: row.subject,
      receivedAt: row.received_at,
      originalEmailText: stripStoredEmailSubject(row.text_content, row.subject),
      attachmentTexts: attachments.map((attachment) => ({
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

  const intakeNeedsReviewCount = emailIntakeRows.reduce((sum, row) => sum + row.needsReviewCount, 0)
  const plannerHref = `/availability${toSearchString(params)}`

  return (
    <div className="availability-page-print space-y-5">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <AvailabilityOverviewHeader
        title="Availability Intake"
        subtitle={
          selectedCycle
            ? `${formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)} · Review incoming requests`
            : 'Review incoming availability requests and matches'
        }
        totalRequests={emailIntakeRows.reduce((sum, row) => sum + row.itemCount, 0)}
        needOffRequests={intakeNeedsReviewCount}
        availableToWorkRequests={emailIntakeRows.reduce(
          (sum, row) => sum + row.autoAppliedCount,
          0
        )}
        responseRatio={null}
        actions={
          <>
            <Button
              asChild
              size="sm"
              className="gap-1.5 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            >
              <Link href={plannerHref}>Back to planner</Link>
            </Button>
            <MoreActionsMenu
              label="Utilities"
              triggerClassName="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border/80 bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
            >
              <a
                href="/api/availability/export"
                className="flex h-11 items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-secondary"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
              <PrintMenuItem />
            </MoreActionsMenu>
          </>
        }
      />

      <div className="border-b border-border/70">
        <nav className="-mb-px flex gap-0" aria-label="Availability sections">
          <Link
            href={plannerHref}
            className={cn(
              'inline-flex h-11 items-center px-4 py-2 text-sm border-b-2 transition-colors border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Planner
          </Link>
          <span
            className={cn(
              'flex h-11 items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors border-primary text-foreground font-medium'
            )}
          >
            Email Intake
            {intakeNeedsReviewCount > 0 ? (
              <span className="rounded-full border border-warning-border bg-warning-subtle px-1.5 py-0.5 text-[10px] font-semibold text-warning-text">
                {intakeNeedsReviewCount}
              </span>
            ) : null}
          </span>
        </nav>
      </div>

      <EmailIntakePanel
        rows={emailIntakeRows}
        applyEmailAvailabilityImportAction={applyEmailAvailabilityImportAction}
        updateEmailIntakeItemRequestAction={updateEmailIntakeItemRequestAction}
        deleteEmailIntakeAction={deleteEmailIntakeAction}
        reparseEmailIntakeAction={reparseEmailIntakeAction}
        updateEmailIntakeTherapistAction={updateEmailIntakeTherapistAction}
        therapistOptions={plannerTherapists.map((therapist) => ({
          id: therapist.id,
          fullName: therapist.full_name,
        }))}
        cycleOptions={cycles.map((cycle) => ({
          id: cycle.id,
          label: `${cycle.label} (${cycle.start_date} to ${cycle.end_date})`,
        }))}
      />
    </div>
  )
}
