import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeftRight, CalendarClock, History } from 'lucide-react'

import {
  StaffAttentionCard,
  badgeToneClasses,
  dueChipToneClasses,
} from '@/components/dashboard/StaffAttentionCard'
import { FeedbackToast } from '@/components/feedback-toast'
import { StaffScheduleBlockPanel } from '@/components/schedule/StaffScheduleBlockPanel'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import { resolveUserRole } from '@/lib/auth/role-source'
import {
  buildTherapistSubmissionUiState,
  resolveAvailabilityDueStatus,
  resolveAvailabilityDueSupportLine,
} from '@/lib/therapist-availability-submission'
import {
  resolveTherapistWorkflow,
  type TherapistWorkflowCycle,
  type TherapistWorkflowPreliminarySnapshot,
} from '@/lib/therapist-workflow'
import {
  countPendingRequestRows,
  formatRequestShiftLabel,
  type RequestShiftPostRow,
} from '@/lib/request-workflow'
import { siteLocalDateKey } from '@/lib/calendar-utils'
import { deriveRequestStage } from '@/lib/request-page-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  fetchMyPublishedUpcomingShifts,
  fetchStaffScheduleBlockView,
  type StaffScheduleBlockCycle,
} from '@/lib/staff-my-schedule'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Therapist dashboard for schedule, requests, and next-step workflow.',
}

type StaffDashboardSearchParams = Record<string, string | string[] | undefined>

type SubmissionRow = {
  schedule_cycle_id: string
  submitted_at: string
  last_edited_at: string
}

type StaffDashboardCycle = TherapistWorkflowCycle & StaffScheduleBlockCycle

type StaffSwapAttentionItem = {
  href: string
  title: string
  detail: string
}

type DashboardSwapRequestRow = RequestShiftPostRow & {
  shifts?:
    | {
        date: string
        shift_type: 'day' | 'night'
      }
    | Array<{
        date: string
        shift_type: 'day' | 'night'
      }>
    | null
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function buildSwapAttentionItems(params: {
  currentUserId: string
  requests: DashboardSwapRequestRow[]
}): StaffSwapAttentionItem[] {
  return params.requests
    .map((request) => {
      const involvement =
        request.posted_by === params.currentUserId
          ? 'posted'
          : request.visibility === 'direct'
            ? 'received_direct'
            : 'claimed'
      const stage = deriveRequestStage({
        currentUserId: params.currentUserId,
        request,
        involvement,
      })
      const shiftRow = Array.isArray(request.shifts) ? request.shifts[0] : request.shifts
      const shiftLabel = shiftRow
        ? formatRequestShiftLabel(shiftRow.date, shiftRow.shift_type)
        : 'this shift'

      if (involvement === 'received_direct' && request.recipient_response === 'pending') {
        return {
          href: `/therapist/swaps?requestId=${request.id}`,
          title: 'You have a trade request to review',
          detail: `${shiftLabel}. Decide whether to accept and send it to the manager.`,
        }
      }

      if (
        request.posted_by === params.currentUserId &&
        request.visibility === 'direct' &&
        request.recipient_response === 'pending'
      ) {
        return {
          href: `/therapist/swaps?requestId=${request.id}`,
          title: 'Your trade request is waiting for teammate response',
          detail: `${shiftLabel}. The request stays private until your teammate responds.`,
        }
      }

      if (
        request.visibility === 'direct' &&
        request.recipient_response === 'accepted' &&
        request.status === 'pending'
      ) {
        return {
          href: `/therapist/swaps?requestId=${request.id}`,
          title: 'A trade request is waiting for manager review',
          detail: `${shiftLabel}. ${stage.detail ?? 'Manager approval is still required.'}`,
        }
      }

      if (request.status === 'pending' && request.visibility === 'team') {
        return {
          href: `/therapist/swaps?requestId=${request.id}`,
          title: 'A board request is waiting for manager review',
          detail: `${shiftLabel}. ${stage.detail ?? 'Manager review is still required.'}`,
        }
      }

      return null
    })
    .filter((item): item is StaffSwapAttentionItem => item !== null)
    .slice(0, 2)
}

function toSearchSuffix(params?: StaffDashboardSearchParams): string {
  if (!params) return ''

  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item)
      }
      continue
    }

    if (typeof value === 'string') {
      query.set(key, value)
    }
  }

  const encoded = query.toString()
  return encoded ? `?${encoded}` : ''
}

function getStaffDashboardFeedback(
  params?: StaffDashboardSearchParams
): { message: string; variant: 'success' } | null {
  const success = getSearchParam(params?.success)
  if (success === 'signed_in') return { message: 'Signed in successfully.', variant: 'success' }
  if (success === 'access_requested') {
    return { message: 'Access request submitted and signed in.', variant: 'success' }
  }
  if (success === 'onboarding_complete') {
    return { message: 'Setup complete. You can use the staff dashboard now.', variant: 'success' }
  }
  return null
}

export default async function StaffDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<StaffDashboardSearchParams>
}) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const params = searchParams ? await searchParams : undefined
  const redirectSuffix = toSearchSuffix(params)
  const feedback = getStaffDashboardFeedback(params)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, site_id, staff_onboarding_required, staff_onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle()

  if (can(resolveUserRole(profile?.role), 'access_manager_ui')) {
    redirect('/dashboard/manager')
  }

  if (!profile?.staff_onboarding_completed_at) {
    redirect(`/onboarding${redirectSuffix}`)
  }

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Staff member'
  const firstName = fullName.split(/\s+/)[0] ?? fullName
  const todayKey = siteLocalDateKey()

  let cyclesQuery = admin
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, archived_at, published, status, availability_due_at')
    .is('archived_at', null)
    .gte('end_date', todayKey)
    .order('start_date', { ascending: true })

  if (profile?.site_id) {
    cyclesQuery = cyclesQuery.eq('site_id', profile.site_id)
  }

  const { data: cyclesData } = await cyclesQuery

  const cycles = ((cyclesData ?? []) as StaffDashboardCycle[]).map((cycle) => ({
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
    staffScheduleAssignmentRowsResult,
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
      .select(
        'id, type, status, visibility, recipient_response, request_kind, created_at, shift_id, posted_by, claimed_by, message, shifts!shift_posts_shift_id_fkey(date, shift_type)'
      )
      .or(`posted_by.eq.${user.id},claimed_by.eq.${user.id}`),
    cycleIds.length > 0
      ? admin.from('shifts').select('cycle_id').eq('user_id', user.id).in('cycle_id', cycleIds)
      : Promise.resolve({ data: [] }),
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
  const relevantShiftPosts = (relevantShiftPostsResult.data ?? []) as DashboardSwapRequestRow[]
  const swapAttentionItems = buildSwapAttentionItems({
    currentUserId: user.id,
    requests: relevantShiftPosts,
  })
  const assignedScheduleCycleIds = new Set(
    ((staffScheduleAssignmentRowsResult.data ?? []) as Array<{ cycle_id: string }>).map(
      (row) => row.cycle_id
    )
  )

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
      pendingCount: countPendingRequestRows(relevantShiftPosts),
      totalCount: relevantShiftPosts.length,
    },
  })
  const workflowScheduleCycle =
    workflow.state === 'preliminary_review_available' ||
    workflow.state === 'published_schedule_available'
      ? cycles.find((cycle) => cycle.id === workflow.actionCycle?.id)
      : null
  const schedulePanelCycle = (cycles.find(
    (cycle) => cycle.status === 'preliminary' && assignedScheduleCycleIds.has(cycle.id)
  ) ??
    cycles.find(
      (cycle) =>
        (cycle.published || cycle.status === 'final') && assignedScheduleCycleIds.has(cycle.id)
    ) ??
    workflowScheduleCycle ??
    cycles.find((cycle) => cycle.status === 'preliminary') ??
    cycles.find((cycle) => cycle.published || cycle.status === 'final') ??
    null) as StaffScheduleBlockCycle | null
  const scheduleBlockView = await fetchStaffScheduleBlockView({
    supabase: admin,
    cycle: schedulePanelCycle,
    userId: user.id,
    todayKey,
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

  const availabilityDueStatus =
    workflow.actionCycle &&
    (workflow.state === 'availability_not_started' || workflow.state === 'availability_draft')
      ? resolveAvailabilityDueStatus(
          {
            start_date: workflow.actionCycle.start_date,
            availability_due_at: workflow.actionCycle.availability_due_at ?? null,
          },
          false
        )
      : null

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

  const workflowAlreadyLinksToSchedule = [
    workflow.primaryAction.href,
    workflow.secondaryAction?.href ?? null,
  ].some((href) => href?.startsWith('/schedule'))

  return (
    <div className="space-y-4">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <section className="rounded-2xl border border-border bg-card px-5 py-5 shadow-tw-float-lg">
        <div className="space-y-2">
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
            {availabilityDueStatus ? (
              <span
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                  dueChipToneClasses(availabilityDueStatus.tone)
                )}
              >
                {availabilityDueStatus.label}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Start with your schedule. Use the next-step card when availability, preliminary review,
            or a request needs your attention.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <StaffScheduleBlockPanel schedule={scheduleBlockView} />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Next step
            </div>
            <StaffAttentionCard
              workflow={workflow}
              submissionUi={submissionUi}
              availabilityDueStatus={availabilityDueStatus}
              availabilityDueLine={availabilityDueLine}
              workflowAlreadyLinksToSchedule={workflowAlreadyLinksToSchedule}
            />
          </div>

          <article className="rounded-2xl border border-border bg-card px-5 py-5 shadow-tw-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Trade &amp; Coverage Requests
                </p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  {workflow.swapSummary.pendingCount} pending
                </h2>
              </div>
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Use this to post or track trade and coverage requests that involve you.
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
                <Link href="/therapist/swaps">Trade &amp; Coverage Requests</Link>
              </Button>
            </div>
            {swapAttentionItems.length > 0 ? (
              <div className="mt-4 space-y-2 rounded-xl border border-border/70 bg-background/65 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Needs attention
                </p>
                {swapAttentionItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg border border-border/70 bg-card px-3 py-3 transition-colors hover:bg-secondary"
                  >
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </Link>
                ))}
              </div>
            ) : null}
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
              Use this to review earlier trade requests, coverage requests, and request results
              without mixing them into what needs attention today.
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
