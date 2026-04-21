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
  buildEmailIntakePanelRows,
  type AvailabilityEmailAttachmentRow,
  type AvailabilityEmailIntakeItemRow,
  type AvailabilityEmailIntakeRow,
  type AvailabilityPageSearchParams,
  type Cycle,
  getAvailabilityFeedback,
  getOne,
  getSearchParam,
  type ManagerPlannerTherapistRow,
  selectAvailabilityIntakeCycle,
  toSearchString,
} from '@/app/(app)/availability/intake/availability-intake-page-data'
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
  const selectedCycle = selectAvailabilityIntakeCycle(cycles, selectedCycleIdFromParams)

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
  const emailIntakeRows: EmailIntakePanelRow[] = buildEmailIntakePanelRows({
    attachments: emailAttachmentRows,
    intakeRows: rawEmailIntakeRows,
    items: emailItemRows,
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
