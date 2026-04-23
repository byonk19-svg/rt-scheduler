import { redirect } from 'next/navigation'

import type { Cycle } from '@/app/schedule/types'
import { ManagerTriageDashboard } from '@/components/manager/ManagerTriageDashboard'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { buildCycleRoute } from '@/lib/cycle-route'
import { getManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import { createClient } from '@/lib/supabase/server'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

type ManagerProfileRow = {
  role: string | null
}

type NotificationRow = {
  event_type: string
  title: string | null
  target_type: 'schedule_cycle' | 'shift' | 'shift_post' | 'system' | null
  created_at?: string | null
}

type ShiftStatusRow = {
  id: string
}

type ShiftDateRow = {
  id: string
  date: string
}

type ShiftAssignmentRow = {
  id: string
  shift_type: 'day' | 'night' | null
  role: 'lead' | 'staff' | null
  profiles: { full_name: string } | { full_name: string }[] | null
}

type ShiftCountRow = {
  shift_type: 'day' | 'night'
  user_id: string | null
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

function getNotificationHref(item: NotificationRow): string {
  if (item.event_type === 'preliminary_request_submitted') return '/approvals'
  if (item.event_type.startsWith('preliminary_')) return '/publish'
  if (item.event_type.includes('publish')) return '/publish/history'
  if (item.target_type === 'shift_post') return '/shift-board'
  if (item.target_type === 'shift') return '/coverage?view=week'
  if (item.target_type === 'schedule_cycle') return '/coverage?view=week'
  if (item.event_type.includes('request')) return '/requests/user-access'
  return '/coverage?view=week'
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
  const title = row.title?.trim()
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

  const [profileResult, unreadReviewCountResult, latestUnreadResult, recentActivityResult] =
    await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null),
      supabase
        .from('notifications')
        .select('event_type, title, target_type')
        .eq('user_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('notifications')
        .select('event_type, title, target_type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  if (profileResult.error) {
    console.error('Failed to load manager profile for dashboard:', profileResult.error)
  }
  if (unreadReviewCountResult.error) {
    console.error('Failed to load unread review count:', unreadReviewCountResult.error)
  }
  if (latestUnreadResult.error) {
    console.error('Failed to load latest unread review item:', latestUnreadResult.error)
  }
  if (recentActivityResult.error) {
    console.error('Failed to load recent manager activity:', recentActivityResult.error)
  }

  const profile = (profileResult.data ?? null) as ManagerProfileRow | null
  if (!can(parseRole(profile?.role), 'access_manager_ui')) {
    redirect('/dashboard/staff')
  }

  const managerAttention = await getManagerAttentionSnapshot(supabase)
  const activeCycle = managerAttention.activeCycle as Cycle | null
  const activeCycleDateRange = activeCycle
    ? `${formatCycleDate(activeCycle.start_date)} - ${formatCycleDate(activeCycle.end_date)}`
    : null
  const latestUnread = (latestUnreadResult.data ?? null) as NotificationRow | null

  let todayCoverageQuery = supabase.from('shifts').select('id').eq('date', todayKey)
  let upcomingShiftsQuery = supabase
    .from('shifts')
    .select('id, date')
    .gte('date', todayKey)
    .lte('date', toIsoDate(addDays(today, 14)))
  let todayActiveShiftsQuery = supabase
    .from('shifts')
    .select('id, shift_type, role, profiles:profiles!shifts_user_id_fkey(full_name)')
    .eq('date', todayKey)
    .order('shift_type', { ascending: true })
    .order('role', { ascending: true })

  if (activeCycle) {
    todayCoverageQuery = todayCoverageQuery.eq('cycle_id', activeCycle.id)
    upcomingShiftsQuery = upcomingShiftsQuery.eq('cycle_id', activeCycle.id)
    todayActiveShiftsQuery = todayActiveShiftsQuery.eq('cycle_id', activeCycle.id)
  }

  const shiftCountQuery = activeCycle
    ? supabase
        .from('shifts')
        .select('shift_type, user_id')
        .eq('cycle_id', activeCycle.id)
        .in('shift_type', ['day', 'night'])
    : Promise.resolve({ data: [], error: null })

  const [todayCoverageResult, upcomingShiftsResult, todayActiveShiftsResult, shiftCountResult] =
    await Promise.all([
      todayCoverageQuery,
      upcomingShiftsQuery,
      todayActiveShiftsQuery,
      shiftCountQuery,
    ])

  if (todayCoverageResult.error) {
    console.error('Failed to load today coverage metric:', todayCoverageResult.error)
  }
  if (upcomingShiftsResult.error) {
    console.error('Failed to load upcoming shifts metric:', upcomingShiftsResult.error)
  }
  if (todayActiveShiftsResult.error) {
    console.error('Failed to load active shifts list:', todayActiveShiftsResult.error)
  }
  if (shiftCountResult.error) {
    console.error('Failed to load shift completion counts:', shiftCountResult.error)
  }

  const todayRows = (todayCoverageResult.data ?? []) as ShiftStatusRow[]
  const upcomingRows = (upcomingShiftsResult.data ?? []) as ShiftDateRow[]
  const todayShiftRows = (todayActiveShiftsResult.data ?? []) as ShiftAssignmentRow[]
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
    upcomingByDayMap.set(row.date, (upcomingByDayMap.get(row.date) ?? 0) + 1)
  }
  const upcomingShiftDays = Array.from(upcomingByDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 3)
    .map(([date, count]) => ({
      label: formatDayLabel(date),
      count,
    }))

  const todayActiveShifts = todayShiftRows
    .filter((row) => isWorkingScheduled(row.id))
    .slice(0, 6)
    .map(formatShiftLine)
  const dayRows = shiftCountRows.filter((row) => row.shift_type === 'day')
  const nightRows = shiftCountRows.filter((row) => row.shift_type === 'night')

  const activityRows = (recentActivityResult.data ?? []) as NotificationRow[]
  const recentActivity = activityRows.map((row) => ({
    title: getActivityTitle(row),
    timeLabel: toRelativeTime(row.created_at),
    href: getNotificationHref(row),
  }))

  const scheduleHref = buildCycleRoute('/coverage', activeCycle?.id ?? null)
  const needsReviewCount = unreadReviewCountResult.count ?? 0
  const needsReviewDetail =
    needsReviewCount > 0
      ? (latestUnread?.title ?? 'Unread review items are waiting.')
      : 'You are caught up.'

  return (
    <ManagerTriageDashboard
      todayCoverageCovered={todayCoverageCovered}
      todayCoverageTotal={todayCoverageTotal}
      upcomingShiftCount={Array.from(upcomingByDayMap.values()).reduce(
        (sum, count) => sum + count,
        0
      )}
      upcomingShiftDays={upcomingShiftDays}
      todayActiveShifts={todayActiveShifts}
      recentActivity={recentActivity}
      pendingRequests={managerAttention.pendingApprovals}
      approvalsWaiting={managerAttention.pendingApprovals}
      needsReviewCount={needsReviewCount}
      needsReviewDetail={needsReviewDetail}
      dayShiftsFilled={dayRows.filter((row) => row.user_id !== null).length}
      dayShiftsTotal={dayRows.length}
      nightShiftsFilled={nightRows.filter((row) => row.user_id !== null).length}
      nightShiftsTotal={nightRows.length}
      approvalsHref={MANAGER_WORKFLOW_LINKS.approvals}
      scheduleHomeHref={MANAGER_WORKFLOW_LINKS.scheduleHome}
      scheduleHref={scheduleHref}
      reviewHref={
        latestUnread ? getNotificationHref(latestUnread) : managerAttention.resolveBlockersLink
      }
      activeCycleDateRange={activeCycleDateRange ?? undefined}
    />
  )
}
