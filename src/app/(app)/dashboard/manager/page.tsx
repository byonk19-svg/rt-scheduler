import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import type { Cycle } from '@/app/schedule/types'
import { ManagerToolAccessDenied } from '@/components/auth/ManagerToolAccessDenied'
import { ManagerTriageDashboard } from '@/components/manager/ManagerTriageDashboard'
import { resolveManagerToolAccess } from '@/lib/auth/manager-tool-access'
import { buildCycleRoute } from '@/lib/cycle-route'
import {
  buildManagerReviewSummary,
  countManagerActionableShiftPosts,
  type ManagerActionShiftPostInterestRow,
  type ManagerActionShiftPostRow,
} from '@/lib/manager-action-work'
import { getNotificationDisplayCopy } from '@/lib/notification-display'
import { resolveNotificationHref } from '@/lib/notification-routing'
import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import { getScheduleBlockLifecycleLabel } from '@/lib/schedule-block-state'
import { availabilityDueDateKey } from '@/lib/schedule-block-planning'
import { createClient } from '@/lib/supabase/server'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manager dashboard for schedule, approval, and coverage follow-up.',
}

type ManagerProfileRow = {
  role: string | null
  is_active: boolean | null
  archived_at: string | null
}

type NotificationRow = {
  event_type: string
  title: string | null
  target_type: 'schedule_cycle' | 'shift' | 'shift_post' | 'system' | null
  target_id: string | null
  created_at?: string | null
}

type ShiftStatusRow = {
  id: string
}

type ShiftDateRow = {
  id: string
  date: string
  user_id: string | null
}

type ShiftAssignmentRow = {
  id: string
  user_id: string | null
  shift_type: 'day' | 'night' | null
  role: 'lead' | 'staff' | null
  profiles: { full_name: string } | { full_name: string }[] | null
}

type ShiftCountRow = {
  shift_type: 'day' | 'night'
  user_id: string | null
}

type DashboardCycle = Cycle & {
  archived_at?: string | null
  availability_due_at?: string | null
  preliminary_target_date?: string | null
  final_publish_target_date?: string | null
  status?: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function formatCycleDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getNextPlanningSummary(
  cycle: DashboardCycle | null,
  todayKey: string
): {
  label: string
  detail: string
  ctaHref: string
} {
  if (!cycle) {
    return {
      label: 'Plan the next Schedule Block',
      detail: 'Create the next six-week Schedule Block and set its planning dates.',
      ctaHref: '/schedule/planning',
    }
  }

  const availabilityDueDate = availabilityDueDateKey(cycle.availability_due_at)
  if (!availabilityDueDate) {
    return {
      label: 'Set availability due date',
      detail: `${cycle.label} is not visible to therapists yet.`,
      ctaHref: `/schedule/planning?cycle=${cycle.id}`,
    }
  }

  if (!cycle.preliminary_target_date) {
    return {
      label:
        availabilityDueDate < todayKey
          ? `Availability past due ${formatCycleDate(availabilityDueDate)}`
          : `Availability due ${formatCycleDate(availabilityDueDate)}`,
      detail: 'Review availability responses and add the Preliminary target date.',
      ctaHref: `/availability?cycle=${cycle.id}`,
    }
  }

  if (!cycle.final_publish_target_date) {
    return {
      label: `Preliminary target ${formatCycleDate(cycle.preliminary_target_date)}`,
      detail: 'Add the Final Publish target date for this Schedule Block.',
      ctaHref: `/schedule?cycle=${cycle.id}`,
    }
  }

  if (availabilityDueDate >= todayKey) {
    return {
      label: `Availability due ${formatCycleDate(availabilityDueDate)}`,
      detail: 'Collect therapist availability for this Schedule Block.',
      ctaHref: `/availability?cycle=${cycle.id}`,
    }
  }

  if (cycle.preliminary_target_date >= todayKey) {
    return {
      label: `Preliminary target ${formatCycleDate(cycle.preliminary_target_date)}`,
      detail: 'Build the schedule before sending Preliminary.',
      ctaHref: `/schedule?cycle=${cycle.id}`,
    }
  }

  return {
    label: `Final Publish target ${formatCycleDate(cycle.final_publish_target_date)}`,
    detail: 'Review and publish from the Schedule workspace.',
    ctaHref: `/schedule?cycle=${cycle.id}`,
  }
}

function formatDayLabel(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function toRelativeTime(value: string | null | undefined): string {
  if (!value) return 'Just now'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Just now'
  const deltaMs = Date.now() - parsed.getTime()
  const deltaMinutes = Math.max(1, Math.round(deltaMs / (1000 * 60)))
  if (deltaMinutes < 60) return `${deltaMinutes} minute${deltaMinutes === 1 ? '' : 's'} ago`
  const deltaHours = Math.round(deltaMinutes / 60)
  if (deltaHours < 24) return `${deltaHours} hour${deltaHours === 1 ? '' : 's'} ago`
  const deltaDays = Math.round(deltaHours / 24)
  return `${deltaDays} day${deltaDays === 1 ? '' : 's'} ago`
}

function formatShiftLine(row: ShiftAssignmentRow): { label: string; detail: string } {
  const fullName = getOne(row.profiles)?.full_name ?? 'Unassigned therapist'
  const shiftLabel =
    row.shift_type === 'night' ? 'Night shift' : row.shift_type === 'day' ? 'Day shift' : 'Shift'
  const roleLabel = row.role === 'lead' ? 'Lead' : 'Staff'
  return {
    label: fullName,
    detail: `${shiftLabel} | ${roleLabel}`,
  }
}

function getActivityTitle(row: NotificationRow): string {
  const title = getNotificationDisplayCopy(row, 'manager').title.trim()
  if (title) return title
  if (row.event_type === 'preliminary_request_submitted') return 'New preliminary request submitted'
  if (row.event_type.includes('publish')) return 'Schedule publish activity'
  if (row.event_type.includes('request')) return 'Request activity updated'
  return 'Dashboard activity update'
}

export default async function ManagerDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const today = new Date()
  const todayKey = toIsoDate(today)

  const profileResult = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profileResult.error) {
    console.error('Failed to load manager profile for dashboard:', profileResult.error)
  }

  const profile = (profileResult.data ?? null) as ManagerProfileRow | null
  const access = resolveManagerToolAccess(profile)
  if (access === 'inactive') redirect('/login?error=account_inactive')
  if (access === 'forbidden') return <ManagerToolAccessDenied toolName="Manager Dashboard" />

  const [cyclesResult, pendingApprovalsResult, pendingShiftPostsResult, recentActivityResult] =
    await Promise.all([
      supabase
        .from('schedule_cycles')
        .select(
          'id, label, start_date, end_date, published, status, archived_at, availability_due_at, preliminary_target_date, final_publish_target_date'
        )
        .is('archived_at', null)
        .gte('end_date', todayKey)
        .order('start_date', { ascending: true }),
      supabase
        .from('preliminary_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('shift_posts')
        .select('id, type, status, created_at, claimed_by, visibility, recipient_response')
        .eq('status', 'pending'),
      supabase
        .from('notifications')
        .select('event_type, title, target_type, target_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  if (cyclesResult.error) {
    console.error('Failed to load cycles for manager dashboard:', cyclesResult.error)
  }
  if (pendingApprovalsResult.error) {
    console.error('Failed to load pending preliminary approvals:', pendingApprovalsResult.error)
  }
  if (pendingShiftPostsResult.error) {
    console.error('Failed to load manager shift post review work:', pendingShiftPostsResult.error)
  }
  if (recentActivityResult.error) {
    console.error('Failed to load recent manager activity:', recentActivityResult.error)
  }

  const cycles = (cyclesResult.data ?? []) as DashboardCycle[]
  const activeCycle =
    cycles.find((cycle) => cycle.start_date <= todayKey && cycle.end_date >= todayKey) ?? null
  const nextCycle = activeCycle
    ? (cycles.find((cycle) => cycle.start_date > activeCycle.end_date) ?? null)
    : (cycles.find((cycle) => cycle.start_date > todayKey) ?? null)
  const activeCycleDateRange = activeCycle
    ? `${formatCycleDate(activeCycle.start_date)} - ${formatCycleDate(activeCycle.end_date)}`
    : null
  const pendingShiftPostRows = (pendingShiftPostsResult.data ?? []) as ManagerActionShiftPostRow[]
  const pendingShiftPostIds = pendingShiftPostRows.map((row) => row.id)
  const pendingShiftPostInterestsResult =
    pendingShiftPostIds.length > 0
      ? await supabase
          .from('shift_post_interests')
          .select('shift_post_id, status')
          .in('shift_post_id', pendingShiftPostIds)
          .in('status', ['pending', 'selected'])
      : { data: [], error: null }

  if (pendingShiftPostInterestsResult.error) {
    console.error(
      'Failed to load manager shift post responder work:',
      pendingShiftPostInterestsResult.error
    )
  }

  const managerShiftPostReviewCount = countManagerActionableShiftPosts({
    posts: pendingShiftPostRows,
    interests: (pendingShiftPostInterestsResult.data ?? []) as ManagerActionShiftPostInterestRow[],
  })

  let todayCoverageQuery = supabase.from('shifts').select('id').eq('date', todayKey)
  let upcomingShiftsQuery = supabase
    .from('shifts')
    .select('id, date, user_id')
    .gte('date', todayKey)
    .lte('date', toIsoDate(addDays(today, 14)))
  let todayStaffedShiftsQuery = supabase
    .from('shifts')
    .select('id, user_id, shift_type, role, profiles:profiles!shifts_user_id_fkey(full_name)')
    .eq('date', todayKey)
    .order('shift_type', { ascending: true })
    .order('role', { ascending: true })

  if (activeCycle) {
    todayCoverageQuery = todayCoverageQuery.eq('cycle_id', activeCycle.id)
    upcomingShiftsQuery = upcomingShiftsQuery.eq('cycle_id', activeCycle.id)
    todayStaffedShiftsQuery = todayStaffedShiftsQuery.eq('cycle_id', activeCycle.id)
  }

  const shiftCountQuery = activeCycle
    ? supabase
        .from('shifts')
        .select('shift_type, user_id')
        .eq('cycle_id', activeCycle.id)
        .in('shift_type', ['day', 'night'])
    : Promise.resolve({ data: [], error: null })

  const [todayCoverageResult, upcomingShiftsResult, todayStaffedShiftsResult, shiftCountResult] =
    await Promise.all([
      todayCoverageQuery,
      upcomingShiftsQuery,
      todayStaffedShiftsQuery,
      shiftCountQuery,
    ])

  if (todayCoverageResult.error) {
    console.error('Failed to load today coverage metric:', todayCoverageResult.error)
  }
  if (upcomingShiftsResult.error) {
    console.error('Failed to load upcoming shifts metric:', upcomingShiftsResult.error)
  }
  if (todayStaffedShiftsResult.error) {
    console.error('Failed to load staffed shifts list:', todayStaffedShiftsResult.error)
  }
  if (shiftCountResult.error) {
    console.error('Failed to load shift completion counts:', shiftCountResult.error)
  }

  const dashboardLoadIssueCount = [
    cyclesResult.error,
    pendingApprovalsResult.error,
    pendingShiftPostsResult.error,
    recentActivityResult.error,
    pendingShiftPostInterestsResult.error,
    todayCoverageResult.error,
    upcomingShiftsResult.error,
    todayStaffedShiftsResult.error,
    shiftCountResult.error,
  ].filter(Boolean).length

  const todayRows = (todayCoverageResult.data ?? []) as ShiftStatusRow[]
  const upcomingRows = (upcomingShiftsResult.data ?? []) as ShiftDateRow[]
  const todayShiftRows = (todayStaffedShiftsResult.data ?? []) as ShiftAssignmentRow[]
  const shiftCountRows = (shiftCountResult.data ?? []) as ShiftCountRow[]

  const activeOperationalCodesByShiftId = await fetchActiveOperationalCodeMap(supabase, [
    ...new Set([
      ...todayRows.map((row) => row.id),
      ...upcomingRows.map((row) => row.id),
      ...todayShiftRows.map((row) => row.id),
    ]),
  ])
  const isWorkingScheduled = (shiftId: string) => !activeOperationalCodesByShiftId.has(shiftId)

  const todayCoverageTotal = todayRows.length
  const todayCoverageCovered = todayRows.filter((row) => isWorkingScheduled(row.id)).length

  const upcomingByDayMap = new Map<string, number>()
  for (const row of upcomingRows) {
    if (!isWorkingScheduled(row.id)) continue
    if (row.user_id !== null) continue
    upcomingByDayMap.set(row.date, (upcomingByDayMap.get(row.date) ?? 0) + 1)
  }
  const upcomingShiftDays = Array.from(upcomingByDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 3)
    .map(([date, count]) => ({
      label: formatDayLabel(date),
      count,
    }))

  const todayStaffedShifts = todayShiftRows
    .filter((row) => isWorkingScheduled(row.id))
    .map(formatShiftLine)
  const dayRows = shiftCountRows.filter((row) => row.shift_type === 'day')
  const nightRows = shiftCountRows.filter((row) => row.shift_type === 'night')

  const activityRows = (recentActivityResult.data ?? []) as NotificationRow[]
  const recentActivity = activityRows.map((row) => ({
    title: getActivityTitle(row),
    timeLabel: toRelativeTime(row.created_at),
    href: resolveNotificationHref(row, 'manager', '/schedule') ?? '/schedule',
  }))

  const scheduleHref = buildCycleRoute('/schedule', activeCycle?.id ?? null)
  const nextCyclePlanning = getNextPlanningSummary(nextCycle, todayKey)
  const activeCycleHasNoShifts =
    Boolean(activeCycle) && dayRows.length === 0 && nightRows.length === 0

  const currentCycleStatus = activeCycle
    ? getScheduleBlockLifecycleLabel({
        published: activeCycle.published,
        status: activeCycle.status,
      })
    : 'No active Schedule Block'

  const currentCycleDetail = activeCycle
    ? activeCycleHasNoShifts
      ? 'No staffing drafted yet. Auto-draft or add the first shifts.'
      : `Publish by ${formatCycleDate(activeCycle.end_date)}`
    : 'No current Schedule Block is active.'

  const nextCycleLabel = nextCyclePlanning.label
  const nextCycleDetail = nextCyclePlanning.detail

  const managerReviewSummary = buildManagerReviewSummary({
    shiftPostReviewCount: managerShiftPostReviewCount,
    preliminaryApprovalCount: pendingApprovalsResult.count ?? 0,
  })
  const needsReviewCount = managerReviewSummary.count
  const needsReviewDetail = managerReviewSummary.detail
  const reviewHref = managerReviewSummary.href

  return (
    <ManagerTriageDashboard
      todayCoverageCovered={todayCoverageCovered}
      todayCoverageTotal={todayCoverageTotal}
      upcomingShiftCount={Array.from(upcomingByDayMap.values()).reduce(
        (sum, count) => sum + count,
        0
      )}
      upcomingShiftDays={upcomingShiftDays}
      todayStaffedShifts={todayStaffedShifts}
      recentActivity={recentActivity}
      pendingRequests={pendingApprovalsResult.count ?? 0}
      approvalsWaiting={pendingApprovalsResult.count ?? 0}
      currentCycleStatus={currentCycleStatus}
      currentCycleHasNoShifts={activeCycleHasNoShifts}
      currentCycleDetail={currentCycleDetail}
      nextCycleLabel={nextCycleLabel}
      nextCycleDetail={nextCycleDetail}
      needsReviewCount={needsReviewCount}
      needsReviewDetail={needsReviewDetail}
      dayShiftsFilled={dayRows.filter((row) => row.user_id !== null).length}
      dayShiftsTotal={dayRows.length}
      nightShiftsFilled={nightRows.filter((row) => row.user_id !== null).length}
      nightShiftsTotal={nightRows.length}
      approvalsHref={MANAGER_WORKFLOW_LINKS.approvals}
      scheduleHref={scheduleHref}
      reviewHref={reviewHref}
      activeCycleDateRange={activeCycleDateRange ?? undefined}
      currentCycleCtaHref={!activeCycle ? '/schedule' : undefined}
      nextCycleCtaHref={nextCyclePlanning.ctaHref}
      dataLoadIssueCount={dashboardLoadIssueCount}
    />
  )
}
