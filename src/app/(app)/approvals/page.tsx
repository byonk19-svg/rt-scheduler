import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Circle,
  CircleCheck,
  CircleMinus,
  Clock,
  Info,
  Moon,
  Sun,
  UserRound,
  UsersRound,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Approvals',
  description: 'Review preliminary shift claims and schedule change requests.',
}

import {
  approvePreliminaryRequestAction,
  denyPreliminaryRequestAction,
} from '@/app/approvals/actions'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { ASSIGNED_ROWS_TARGET } from '@/lib/coverage/selectors'
import { toManagerPreliminaryQueue } from '@/lib/preliminary-schedule/selectors'
import type {
  ManagerPreliminaryQueueItem,
  PreliminaryRequestRow,
  PreliminaryShiftRow,
} from '@/lib/preliminary-schedule/types'
import { createClient } from '@/lib/supabase/server'

type ApprovalsSearchParams = Record<string, string | string[] | undefined>

type ProfileNameRow = {
  id: string
  full_name: string | null
  shift_type?: 'day' | 'night' | null
}

type ActivePreliminarySnapshotRow = {
  id: string
}

type CycleSummaryRow = {
  id: string
  label: string | null
  start_date: string
  end_date: string
}

type ImpactShiftRow = {
  id: string
  cycle_id: string | null
  user_id: string | null
  date: string
  shift_type: 'day' | 'night'
  status: string
  role: string
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function formatDateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatCycleRange(cycle: CycleSummaryRow | null | undefined) {
  if (!cycle) return 'Current Schedule Block'

  const start = new Date(`${cycle.start_date}T00:00:00`)
  const end = new Date(`${cycle.end_date}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return cycle.label ?? 'Current Schedule Block'
  }

  const sameYear = start.getFullYear() === end.getFullYear()
  const startLabel = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
  const endLabel = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return `${startLabel} - ${endLabel}`
}

function formatShiftType(shiftType: 'day' | 'night') {
  return shiftType === 'day' ? 'Day' : 'Night'
}

function formatShiftRole(role: string) {
  if (role === 'lead') return 'Lead'
  if (role === 'staff') return 'Staff'
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getRequestTitle(request: ManagerPreliminaryQueueItem) {
  if (request.requestType === 'claim_open_shift') {
    return request.isOppositeShiftRequest
      ? 'Open-slot claim outside usual shift'
      : 'Open-slot claim'
  }

  return 'Schedule change request'
}

function getRequestSummary(request: ManagerPreliminaryQueueItem) {
  const slot = `${formatShiftType(request.shiftType)} ${formatShiftRole(request.shiftRole)} slot`

  if (request.requestType === 'claim_open_shift') {
    return `${request.requesterName} wants to fill this ${request.assignedName ? 'assigned' : 'open'} ${slot}.`
  }

  return `${request.requesterName} is asking to change this preliminary ${slot}.`
}

function getDecisionHelp(request: ManagerPreliminaryQueueItem) {
  if (request.requestType === 'claim_open_shift') {
    return {
      approve: `Approve assigns ${request.requesterName} to this preliminary slot.`,
      deny: request.assignedName
        ? `Deny leaves ${request.assignedName} on the preliminary schedule.`
        : 'Deny keeps this preliminary slot open.',
    }
  }

  return {
    approve: 'Approve applies the requested preliminary schedule change.',
    deny: 'Deny leaves the preliminary schedule unchanged.',
  }
}

function getApprovalImpact(request: ManagerPreliminaryQueueItem, slotRows: ImpactShiftRow[]) {
  const assignedRows = slotRows.filter((row) => Boolean(row.user_id))
  const roleAssignedRows = assignedRows.filter((row) => row.role === request.shiftRole)
  const before = assignedRows.length
  const roleBefore = roleAssignedRows.length
  const requestedSlotIsOpen = request.requestType === 'claim_open_shift' && !request.assignedName
  const requestedChangeRemovesAssignment =
    request.requestType === 'request_change' && Boolean(request.assignedName)
  const after = requestedSlotIsOpen
    ? before + 1
    : requestedChangeRemovesAssignment
      ? Math.max(before - 1, 0)
      : before
  const roleAfter = requestedSlotIsOpen
    ? roleBefore + 1
    : requestedChangeRemovesAssignment
      ? Math.max(roleBefore - 1, 0)
      : roleBefore
  const target = Math.max(ASSIGNED_ROWS_TARGET, before, after)

  return {
    before,
    after,
    target,
    roleBefore,
    roleAfter,
    delta: after - before,
  }
}

function getPreviewAssignment(request: ManagerPreliminaryQueueItem) {
  if (request.requestType === 'claim_open_shift') {
    return {
      before: request.assignedName ?? 'Open slot',
      after: request.requesterName,
      afterDetail: 'Request would fill',
    }
  }

  return {
    before: request.assignedName ?? request.requesterName,
    after: 'Open slot',
    afterDetail: 'Approval would open',
  }
}

function renderStaffedDots(filled: number, total: number, highlightIndex?: number) {
  return Array.from({ length: total }, (_, index) => {
    const isFilled = index < filled
    const isHighlighted = highlightIndex === index

    return (
      <span
        key={index}
        className={`h-3 w-3 rounded-full ${
          isFilled
            ? isHighlighted
              ? 'bg-[var(--accent)] ring-2 ring-[var(--warning-border)]'
              : 'bg-[var(--success)]'
            : 'bg-border/75'
        }`}
      />
    )
  })
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<ApprovalsSearchParams>
}) {
  const params = searchParams ? await searchParams : undefined
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !can(parseRole(profile?.role), 'manage_schedule', {
      isActive: profile?.is_active !== false,
      archivedAt: profile?.archived_at ?? null,
    })
  ) {
    redirect('/dashboard')
  }

  const { data: requestsData, error: requestsError } = await supabase
    .from('preliminary_requests')
    .select(
      'id, snapshot_id, shift_id, requester_id, type, status, note, decision_note, approved_by, approved_at, created_at'
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (requestsError) {
    return (
      <div className="space-y-4">
        <ManagerWorkspaceHeader
          title="Preliminary approvals"
          subtitle="Review live claims and schedule change requests before final publish."
          summary={
            <span className="rounded-full border border-border/70 bg-muted/15 px-3 py-1 font-medium text-foreground">
              Couldn&apos;t load requests
            </span>
          }
        />
        <div className="rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-text)]">
          Couldn&apos;t load approval requests. Try refreshing the page.
        </div>
      </div>
    )
  }

  const requests = (requestsData ?? []) as PreliminaryRequestRow[]
  const shiftIds = Array.from(new Set(requests.map((request) => request.shift_id)))
  const requesterIds = Array.from(new Set(requests.map((request) => request.requester_id)))

  const [{ data: shiftsData }, { data: requesterProfilesData }] = await Promise.all([
    shiftIds.length
      ? supabase
          .from('shifts')
          .select(
            'id, cycle_id, user_id, date, shift_type, status, role, profiles:profiles!shifts_user_id_fkey(full_name)'
          )
          .in('id', shiftIds)
      : Promise.resolve({ data: [] }),
    requesterIds.length
      ? supabase.from('profiles').select('id, full_name, shift_type').in('id', requesterIds)
      : Promise.resolve({ data: [] }),
  ])

  const shiftsById = new Map(
    (
      (shiftsData ?? []) as Array<
        PreliminaryShiftRow & {
          profiles: { full_name: string | null } | { full_name: string | null }[] | null
        }
      >
    ).map((shift) => [
      shift.id,
      {
        id: shift.id,
        cycle_id: shift.cycle_id,
        user_id: shift.user_id,
        date: shift.date,
        shift_type: shift.shift_type,
        status: shift.status,
        role: shift.role,
        full_name: getOne(shift.profiles)?.full_name ?? null,
      } satisfies PreliminaryShiftRow,
    ])
  )

  const requesterNames = new Map(
    ((requesterProfilesData ?? []) as ProfileNameRow[]).map((row) => [
      row.id,
      row.full_name ?? 'Unknown',
    ])
  )
  const requesterShiftTypes = new Map(
    ((requesterProfilesData ?? []) as ProfileNameRow[]).map((row) => [
      row.id,
      row.shift_type ?? null,
    ])
  )

  const queue = toManagerPreliminaryQueue(
    requests.map((request) => ({
      ...request,
      requester_name: requesterNames.get(request.requester_id) ?? 'Unknown',
    })),
    shiftsById,
    requesterShiftTypes
  )

  const cycleIds = Array.from(
    new Set(
      [...shiftsById.values()]
        .map((shift) => shift.cycle_id)
        .filter((cycleId): cycleId is string => Boolean(cycleId))
    )
  )

  const [
    { data: impactShiftsData },
    { data: cycleSummariesData },
    { data: activePreliminaryData },
  ] = await Promise.all([
    cycleIds.length
      ? supabase
          .from('shifts')
          .select('id, cycle_id, user_id, date, shift_type, status, role')
          .in('cycle_id', cycleIds)
      : Promise.resolve({ data: [] }),
    cycleIds.length
      ? supabase
          .from('schedule_cycles')
          .select('id, label, start_date, end_date')
          .in('id', cycleIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('preliminary_snapshots')
      .select('id')
      .eq('status', 'active')
      .order('sent_at', { ascending: false })
      .limit(1),
  ])

  const impactRows = (impactShiftsData ?? []) as ImpactShiftRow[]
  const cyclesById = new Map(
    ((cycleSummariesData ?? []) as CycleSummaryRow[]).map((cycle) => [cycle.id, cycle])
  )
  const hasActivePreliminary =
    ((activePreliminaryData ?? []) as ActivePreliminarySnapshotRow[]).length > 0

  return (
    <div className="space-y-6">
      <ManagerWorkspaceHeader
        title="Preliminary approvals"
        subtitle="Review live claims and schedule change requests before final publish."
        summary={
          <>
            <span className="rounded-full bg-[var(--warning-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--warning-text)]">
              {queue.length} pending
            </span>
            {success === 'preliminary_request_approved' && (
              <>
                <span className="text-border/90">/</span>
                <span className="text-[var(--success-text)]">Request approved</span>
              </>
            )}
            {success === 'preliminary_request_denied' && (
              <>
                <span className="text-border/90">/</span>
                <span className="text-[var(--warning-text)]">Request denied</span>
              </>
            )}
          </>
        }
        actions={
          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link href="/schedule">
              <CalendarDays className="h-3.5 w-3.5" />
              Back to schedule
            </Link>
          </Button>
        }
      />

      {error === 'preliminary_review_failed' && (
        <div className="rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-text)]">
          Couldn&apos;t save that decision. Try again.
        </div>
      )}

      {queue.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-background/70 px-6 py-6 shadow-none">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Clock className="h-10 w-10 text-muted-foreground" />
            <p className="text-base font-semibold text-foreground">
              No pending preliminary requests
            </p>
            <p className="text-sm text-muted-foreground">
              {hasActivePreliminary
                ? 'Claims and change requests appear here while the preliminary schedule is live.'
                : 'Send a preliminary schedule from Schedule to open this queue.'}
            </p>
            <Button asChild variant="default">
              <Link href="/schedule">Open Schedule</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-4">
            {queue.map((request) => {
              const decisionHelp = getDecisionHelp(request)
              const shift = shiftsById.get(request.shiftId) ?? null
              const slotRows = shift?.cycle_id
                ? impactRows.filter(
                    (row) =>
                      row.cycle_id === shift.cycle_id &&
                      row.date === request.shiftDate &&
                      row.shift_type === request.shiftType
                  )
                : []
              const impact = getApprovalImpact(request, slotRows)
              const previewAssignment = getPreviewAssignment(request)
              const cycle = shift?.cycle_id ? cyclesById.get(shift.cycle_id) : null

              return (
                <article
                  key={request.id}
                  className="overflow-hidden rounded-xl border border-border/70 bg-card/90 shadow-tw-sm"
                >
                  <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="px-4 py-4 sm:px-6 sm:py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <UserRound className="h-5 w-5 text-muted-foreground" />
                            <p className="text-lg font-semibold text-foreground">
                              {request.requesterName}
                            </p>
                            <StatusBadge variant="warning" dot={false} className="text-xs">
                              {getRequestTitle(request)}
                            </StatusBadge>
                          </div>
                          <p className="mt-2 text-sm font-medium text-foreground">
                            {getRequestSummary(request)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-right text-xs text-muted-foreground">
                          <CalendarDays className="h-4 w-4 text-foreground" />
                          <div>
                            <p className="font-semibold text-foreground">
                              {formatCycleRange(cycle)}
                            </p>
                            <p>Preliminary Schedule Block</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5">
                        <h2 className="text-sm font-semibold text-foreground">Affected shift</h2>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="flex min-h-12 items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm font-medium text-foreground">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            {formatDateLabel(request.shiftDate)}
                          </div>
                          <div className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-2 text-sm font-medium text-[var(--warning-text)]">
                            {request.shiftType === 'day' ? (
                              <Sun className="h-4 w-4" />
                            ) : (
                              <Moon className="h-4 w-4" />
                            )}
                            {formatShiftType(request.shiftType)} shift
                          </div>
                          <div className="flex min-h-12 items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm font-medium text-foreground">
                            <UserRound className="h-4 w-4 text-muted-foreground" />
                            Role: {formatShiftRole(request.shiftRole)}
                          </div>
                          <div className="flex min-h-12 items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm font-medium text-foreground">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            Current: {request.assignedName ?? 'Open'}
                          </div>
                          {request.requesterShiftType ? (
                            <div className="flex min-h-12 items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm font-medium text-foreground sm:col-span-2">
                              {request.requesterShiftType === 'day' ? (
                                <Sun className="h-4 w-4 text-[var(--warning-text)]" />
                              ) : (
                                <Moon className="h-4 w-4 text-[var(--night-text)]" />
                              )}
                              Usual shift: {formatShiftType(request.requesterShiftType)}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-5 border-t border-border/70 pt-4">
                        <h2 className="text-sm font-semibold text-foreground">Coverage impact</h2>
                        <div className="mt-3 grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                          <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                            <p className="text-xs font-medium text-muted-foreground">Before</p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <p className="text-base font-semibold text-foreground">
                                {impact.before} / {impact.target} staffed
                              </p>
                              <div className="flex gap-1" aria-hidden="true">
                                {renderStaffedDots(impact.before, impact.target)}
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="mx-auto hidden h-5 w-5 text-muted-foreground sm:block" />
                          <div className="rounded-lg border border-[var(--success-border)] bg-[var(--success-subtle)] px-4 py-3">
                            <p className="text-xs font-medium text-[var(--success-text)]">
                              After approval
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <p className="text-base font-semibold text-foreground">
                                {impact.after} / {impact.target} staffed
                              </p>
                              <div className="flex gap-1" aria-hidden="true">
                                {renderStaffedDots(
                                  impact.after,
                                  impact.target,
                                  impact.delta > 0 ? impact.after - 1 : undefined
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatShiftType(request.shiftType)} {formatShiftRole(request.shiftRole)}:{' '}
                          {impact.roleBefore} to {impact.roleAfter} filled
                        </p>
                      </div>

                      {request.note && (
                        <div className="mt-5 rounded-lg border border-border/60 bg-background px-4 py-3 text-sm text-foreground">
                          <span className="block text-xs font-semibold uppercase text-muted-foreground">
                            Request note
                          </span>
                          {request.note}
                        </div>
                      )}
                      {request.isOppositeShiftRequest ? (
                        <div className="mt-4 flex gap-2 text-sm text-muted-foreground">
                          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
                          <p>
                            This is outside the therapist&apos;s usual shift. Approve only if that
                            exception is intentional for this date.
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <aside className="border-t border-border/70 bg-background/70 px-4 py-4 xl:border-l xl:border-t-0 xl:px-5 xl:py-5">
                      <h2 className="text-sm font-semibold text-foreground">Schedule preview</h2>
                      <div className="mt-3 rounded-xl border border-border/80 bg-card px-3 py-3 text-center shadow-tw-xs">
                        <p className="text-xs font-bold uppercase text-muted-foreground">
                          {formatDateLabel(request.shiftDate).split(',')[0]}
                        </p>
                        <p className="text-lg font-semibold text-foreground">
                          {formatDateLabel(request.shiftDate).replace(/^.*?, /, '')}
                        </p>
                        <div className="mt-3 rounded-md bg-[var(--warning-subtle)] px-3 py-2 text-sm font-semibold text-[var(--warning-text)]">
                          {formatShiftType(request.shiftType)}
                        </div>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {formatShiftRole(request.shiftRole)}
                        </p>
                        <div className="mt-3 rounded-lg border border-dashed border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-3 text-left">
                          <div className="flex items-start gap-2">
                            <UserRound className="mt-0.5 h-4 w-4 text-[var(--warning-text)]" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">
                                {previewAssignment.before}
                              </p>
                              <div className="my-1 flex items-center gap-2 text-xs text-muted-foreground">
                                <ArrowRight className="h-3.5 w-3.5" />
                                <span>{previewAssignment.afterDetail}</span>
                              </div>
                              <p className="truncate text-sm font-semibold text-[var(--success-text)]">
                                {previewAssignment.after}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
                        <p>{decisionHelp.approve}</p>
                        <p>{decisionHelp.deny}</p>
                      </div>

                      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                        <form action={approvePreliminaryRequestAction}>
                          <input type="hidden" name="request_id" value={request.id} />
                          <Button type="submit" size="lg" className="w-full">
                            Approve
                          </Button>
                        </form>
                        <form action={denyPreliminaryRequestAction}>
                          <input type="hidden" name="request_id" value={request.id} />
                          <Button type="submit" size="lg" variant="outline" className="w-full">
                            Deny
                          </Button>
                        </form>
                      </div>
                    </aside>
                  </div>
                </article>
              )
            })}
          </div>

          <aside className="h-fit rounded-xl border border-border/70 bg-card/90 px-4 py-4 shadow-tw-sm lg:sticky lg:top-24">
            <h2 className="text-sm font-semibold text-foreground">Approvals summary</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Pending
                </span>
                <span className="rounded-md bg-[var(--warning-subtle)] px-2 py-1 font-semibold text-[var(--warning-text)]">
                  {queue.length}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <CircleCheck className="h-4 w-4 text-[var(--success-text)]" />
                  Approved this visit
                </span>
                <span className="rounded-md bg-[var(--success-subtle)] px-2 py-1 font-semibold text-[var(--success-text)]">
                  {success === 'preliminary_request_approved' ? 1 : 0}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <CircleMinus className="h-4 w-4 text-[var(--error-text)]" />
                  Denied this visit
                </span>
                <span className="rounded-md bg-[var(--error-subtle)] px-2 py-1 font-semibold text-[var(--error-text)]">
                  {success === 'preliminary_request_denied' ? 1 : 0}
                </span>
              </div>
            </div>

            <div className="mt-5 border-t border-border/70 pt-4">
              <h3 className="text-sm font-semibold text-foreground">Impact guide</h3>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Circle className="h-3.5 w-3.5 fill-[var(--success)] text-[var(--success)]" />
                  Filled before approval
                </span>
                <span className="inline-flex items-center gap-2">
                  <Circle className="h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]" />
                  Added by approval
                </span>
                <span className="inline-flex items-center gap-2">
                  <UsersRound className="h-4 w-4" />
                  Target uses the five-row schedule view
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
