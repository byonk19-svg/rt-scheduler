import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeftRight, CalendarClock, Clock, History, Send } from 'lucide-react'

import { FeedbackToast } from '@/components/feedback-toast'
import { MyScheduleCard } from '@/components/schedule/MyScheduleCard'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import {
  buildTherapistSubmissionUiState,
  resolveAvailabilityDueSupportLine,
} from '@/lib/therapist-availability-submission'
import {
  resolveTherapistWorkflow,
  type TherapistWorkflowCycle,
  type TherapistWorkflowPreliminarySnapshot,
} from '@/lib/therapist-workflow'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { fetchMyPublishedUpcomingShifts } from '@/lib/staff-my-schedule'
import { cn } from '@/lib/utils'

type StaffDashboardSearchParams = {
  success?: string | string[]
}

type SubmissionRow = {
  schedule_cycle_id: string
  submitted_at: string
  last_edited_at: string
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getStaffDashboardFeedback(
  params?: StaffDashboardSearchParams
): { message: string; variant: 'success' } | null {
  const success = getSearchParam(params?.success)
  if (success === 'signed_in') return { message: 'Signed in successfully.', variant: 'success' }
  if (success === 'access_requested') {
    return { message: 'Access request submitted and signed in.', variant: 'success' }
  }
  return null
}

function badgeToneClasses(state: string): string {
  switch (state) {
    case 'published_schedule_available':
      return 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
    case 'preliminary_review_available':
      return 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
    case 'availability_draft':
    case 'availability_not_started':
      return 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
    default:
      return 'border-border/70 bg-muted/20 text-foreground'
  }
}

export default async function StaffDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<StaffDashboardSearchParams>
}) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const params = searchParams ? await searchParams : undefined
  const feedback = getStaffDashboardFeedback(params)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (can(parseRole(profile?.role), 'access_manager_ui')) {
    redirect('/dashboard/manager')
  }

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Staff member'
  const firstName = fullName.split(/\s+/)[0] ?? fullName
  const todayKey = new Date().toISOString().slice(0, 10)

  const { data: cyclesData } = await admin
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, archived_at, published, availability_due_at')
    .is('archived_at', null)
    .gte('end_date', todayKey)
    .order('start_date', { ascending: true })

  const cycles = ((cyclesData ?? []) as TherapistWorkflowCycle[]).map((cycle) => ({
    ...cycle,
    availability_due_at: cycle.availability_due_at ?? null,
  }))
  const cycleIds = cycles.map((cycle) => cycle.id)

  const [
    upcomingPublishedWidget,
    availabilityDraftRowsResult,
    therapistSubmissionRowsResult,
    preliminarySnapshotsResult,
    relevantShiftPostsResult,
  ] = await Promise.all([
    fetchMyPublishedUpcomingShifts(supabase, user.id, 5),
    cycleIds.length > 0
      ? supabase
          .from('availability_overrides')
          .select('cycle_id')
          .eq('therapist_id', user.id)
          .in('cycle_id', cycleIds)
      : Promise.resolve({ data: [] }),
    cycleIds.length > 0
      ? supabase
          .from('therapist_availability_submissions')
          .select('schedule_cycle_id, submitted_at, last_edited_at')
          .eq('therapist_id', user.id)
          .in('schedule_cycle_id', cycleIds)
      : Promise.resolve({ data: [] }),
    cycleIds.length > 0
      ? admin
          .from('preliminary_snapshots')
          .select('cycle_id, status')
          .eq('status', 'active')
          .in('cycle_id', cycleIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('shift_posts')
      .select('id, status')
      .or(`posted_by.eq.${user.id},claimed_by.eq.${user.id}`),
  ])

  const availabilityEntryCountsByCycleId: Record<string, number> = {}
  for (const row of availabilityDraftRowsResult.data ?? []) {
    const cycleId = (row as { cycle_id: string }).cycle_id
    availabilityEntryCountsByCycleId[cycleId] = (availabilityEntryCountsByCycleId[cycleId] ?? 0) + 1
  }

  const submissionsByCycleId: Record<string, { submittedAt: string; lastEditedAt: string }> = {}
  for (const row of (therapistSubmissionRowsResult.data ?? []) as SubmissionRow[]) {
    submissionsByCycleId[row.schedule_cycle_id] = {
      submittedAt: row.submitted_at,
      lastEditedAt: row.last_edited_at,
    }
  }

  const preliminarySnapshots =
    ((preliminarySnapshotsResult.data ?? []) as TherapistWorkflowPreliminarySnapshot[]) ?? []
  const relevantShiftPosts = (relevantShiftPostsResult.data ?? []) as Array<{ status: string }>

  const workflow = resolveTherapistWorkflow({
    todayKey,
    cycles,
    availabilityEntryCountsByCycleId,
    submissionsByCycleId,
    preliminarySnapshots,
    publishedShifts: upcomingPublishedWidget.map((shift) => ({
      cycle_id: shift.cycle_id,
      date: shift.date,
    })),
    relevantShiftPostSummary: {
      pendingCount: relevantShiftPosts.filter((post) => post.status === 'pending').length,
      totalCount: relevantShiftPosts.length,
    },
  })

  const actionCycleSubmission = workflow.actionCycle
    ? (submissionsByCycleId[workflow.actionCycle.id] ?? null)
    : null
  const submissionUi = buildTherapistSubmissionUiState(
    workflow.actionCycle && actionCycleSubmission
      ? {
          schedule_cycle_id: workflow.actionCycle.id,
          submitted_at: actionCycleSubmission.submittedAt,
          last_edited_at: actionCycleSubmission.lastEditedAt,
        }
      : null
  )

  const availabilityDueLine =
    workflow.actionCycle &&
    (workflow.state === 'availability_not_started' || workflow.state === 'availability_draft')
      ? resolveAvailabilityDueSupportLine(
          {
            start_date: workflow.actionCycle.start_date,
            availability_due_at: workflow.actionCycle.availability_due_at ?? null,
          },
          false
        )
      : null

  return (
    <div className="space-y-4">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <section className="rounded-2xl border border-border bg-card px-5 py-5 shadow-tw-float-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Welcome, {firstName}
              </h1>
              <span
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                  badgeToneClasses(workflow.state)
                )}
              >
                {workflow.stateLabel}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Your dashboard always shows the next therapist-safe action for the current workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={workflow.primaryAction.href}>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {workflow.primaryAction.label}
              </Link>
            </Button>
            {workflow.secondaryAction ? (
              <Button asChild size="sm" variant="outline">
                <Link href={workflow.secondaryAction.href}>{workflow.secondaryAction.label}</Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link href="/therapist/schedule">View my shifts</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
        <article className="rounded-2xl border border-border bg-card px-5 py-5 shadow-tw-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            What needs your attention now
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
            {workflow.primaryTitle}
          </h2>
          {workflow.cycleLabel && workflow.cycleRangeLabel ? (
            <div className="mt-3 rounded-xl border border-border/70 bg-muted/15 px-3 py-3">
              <p className="text-sm font-semibold text-foreground">{workflow.cycleLabel}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{workflow.cycleRangeLabel}</p>
              {workflow.cycleReason ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {workflow.cycleReason}
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {workflow.primaryDescription}
          </p>
          {availabilityDueLine ? (
            <p className="mt-3 text-sm font-medium text-foreground">{availabilityDueLine}</p>
          ) : null}
          {submissionUi.isSubmitted && submissionUi.submittedAtDisplay ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Submitted {submissionUi.submittedAtDisplay}
            </p>
          ) : null}
          {submissionUi.isSubmitted && submissionUi.lastEditedDisplay ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Updated after submit {submissionUi.lastEditedDisplay}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={workflow.primaryAction.href}>{workflow.primaryAction.label}</Link>
            </Button>
            {workflow.secondaryAction ? (
              <Button asChild size="sm" variant="outline">
                <Link href={workflow.secondaryAction.href}>{workflow.secondaryAction.label}</Link>
              </Button>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-card px-5 py-5 shadow-tw-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                My Schedule
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                {workflow.publishedShiftSummary.upcomingCount} upcoming published shift
                {workflow.publishedShiftSummary.upcomingCount === 1 ? '' : 's'}
              </h2>
            </div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Published shifts only. Draft and preliminary assignments stay out of this view until the
            schedule is finalized.
          </p>
          {upcomingPublishedWidget.length > 0 ? (
            <div className="mt-4 space-y-2">
              {upcomingPublishedWidget.slice(0, 3).map((row) => (
                <MyScheduleCard
                  key={row.id}
                  date={row.date}
                  shiftType={row.shift_type === 'night' ? 'night' : 'day'}
                  role={row.role ?? 'staff'}
                  status={row.status}
                  assignmentStatus={row.assignment_status}
                />
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-border bg-muted p-4 text-center text-sm text-muted-foreground">
              No published shifts
            </div>
          )}
          <div className="mt-4">
            <Button asChild size="sm" variant="outline">
              <Link href="/therapist/schedule">View my shifts</Link>
            </Button>
          </div>
        </article>

        <div className="space-y-4">
          <article className="rounded-2xl border border-border bg-card px-5 py-5 shadow-tw-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Shift Swaps &amp; Pickups
                </p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  {workflow.swapSummary.pendingCount} pending
                </h2>
              </div>
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Relevant request activity includes both posts you created and pickups or swaps you
              claimed.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5">
                {workflow.swapSummary.totalCount} total relevant requests
              </span>
              <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5">
                Post-publish only
              </span>
            </div>
            <div className="mt-4">
              <Button asChild size="sm" variant="outline">
                <Link href="/therapist/swaps">Shift Swaps &amp; Pickups</Link>
              </Button>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-card px-5 py-5 shadow-tw-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  History
                </p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  Past requests and outcomes
                </h2>
              </div>
              <History className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Review earlier swaps, pickups, and request outcomes without mixing them into the
              active workflow.
            </p>
            <div className="mt-4">
              <Button asChild size="sm" variant="outline">
                <Link href="/staff/history">View history</Link>
              </Button>
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}
