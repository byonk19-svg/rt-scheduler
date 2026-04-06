'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { Cycle } from '@/app/schedule/types'
import { ManagerTriageDashboard } from '@/components/manager/ManagerTriageDashboard'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { buildCycleRoute } from '@/lib/cycle-route'
import { getNextCyclePlanningWindow } from '@/lib/manager-inbox'
import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import { createClient } from '@/lib/supabase/client'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

const LOADING_LABEL = 'Loading...'

type DashboardData = {
  pendingApprovals: number
  activeCycle: Cycle | null
  nextCycle: Cycle | null
  unreadReviewCount: number
  latestUnreadTitle: string | null
  latestUnreadHref: string
  todayCoverageCovered: number
  todayCoverageTotal: number
  upcomingShiftCount: number
  upcomingShiftDays: Array<{ label: string; count: number }>
  todayActiveShifts: Array<{ label: string; detail: string }>
  recentActivity: Array<{ title: string; timeLabel: string; href: string }>
  dayShiftsFilled: number
  dayShiftsTotal: number
  nightShiftsFilled: number
  nightShiftsTotal: number
}

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

const INITIAL_DATA: DashboardData = {
  pendingApprovals: 0,
  activeCycle: null,
  nextCycle: null,
  unreadReviewCount: 0,
  latestUnreadTitle: null,
  latestUnreadHref: '/coverage?view=week',
  todayCoverageCovered: 0,
  todayCoverageTotal: 0,
  upcomingShiftCount: 0,
  upcomingShiftDays: [],
  todayActiveShifts: [],
  recentActivity: [],
  dayShiftsFilled: 0,
  dayShiftsTotal: 0,
  nightShiftsFilled: 0,
  nightShiftsTotal: 0,
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
  if (item.event_type.startsWith('preliminary_')) return '/preliminary'
  if (item.target_type === 'shift_post') return '/requests'
  if (item.target_type === 'shift') return '/coverage?view=week'
  if (item.target_type === 'schedule_cycle') return '/coverage?view=week'
  if (item.event_type.includes('request')) return '/requests'
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

export default function ManagerDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData>(INITIAL_DATA)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const supabase = createClient()

    async function loadDashboard() {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const user = authData.user

        if (!user) {
          router.replace('/login')
          return
        }

        const today = new Date()
        const todayKey = toIsoDate(today)

        const [
          profileResult,
          cyclesResult,
          pendingApprovalsResult,
          unreadReviewCountResult,
          latestUnreadResult,
          recentActivityResult,
        ] = await Promise.all([
          supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
          supabase
            .from('schedule_cycles')
            .select('id, label, start_date, end_date, published, archived_at')
            .is('archived_at', null)
            .gte('end_date', todayKey)
            .order('start_date', { ascending: true }),
          supabase
            .from('preliminary_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
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
        if (cyclesResult.error) {
          console.error('Failed to load cycles for manager dashboard:', cyclesResult.error)
        }
        if (pendingApprovalsResult.error) {
          console.error(
            'Failed to load pending preliminary approvals:',
            pendingApprovalsResult.error
          )
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
          router.replace('/dashboard/staff')
          return
        }

        const cycles = ((cyclesResult.data ?? []) as Cycle[]) ?? []
        const activeCycle =
          cycles.find((cycle) => cycle.start_date <= todayKey && cycle.end_date >= todayKey) ?? null
        const nextCycle = activeCycle
          ? (cycles.find((cycle) => cycle.start_date > activeCycle.end_date) ?? null)
          : (cycles.find((cycle) => cycle.start_date > todayKey) ?? null)
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

        const [
          todayCoverageResult,
          upcomingShiftsResult,
          todayActiveShiftsResult,
          shiftCountResult,
        ] = await Promise.all([
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
        const isWorkingScheduled = (shiftId: string) =>
          !activeOperationalCodesByShiftId.has(shiftId)

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

        if (!isMounted) return

        setData({
          pendingApprovals: pendingApprovalsResult.count ?? 0,
          activeCycle,
          nextCycle,
          unreadReviewCount: unreadReviewCountResult.count ?? 0,
          latestUnreadTitle: latestUnread?.title ?? null,
          latestUnreadHref: latestUnread
            ? getNotificationHref(latestUnread)
            : '/coverage?view=week',
          todayCoverageCovered,
          todayCoverageTotal,
          upcomingShiftCount: Array.from(upcomingByDayMap.values()).reduce(
            (sum, count) => sum + count,
            0
          ),
          upcomingShiftDays,
          todayActiveShifts,
          recentActivity,
          dayShiftsFilled: dayRows.filter((row) => row.user_id !== null).length,
          dayShiftsTotal: dayRows.length,
          nightShiftsFilled: nightRows.filter((row) => row.user_id !== null).length,
          nightShiftsTotal: nightRows.length,
        })
      } catch (error) {
        console.error('Failed to load manager dashboard data:', error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void loadDashboard()
    return () => {
      isMounted = false
    }
  }, [router])

  const scheduleHref = buildCycleRoute('/coverage', data.activeCycle?.id ?? null)
  const nextCyclePlanning = getNextCyclePlanningWindow(data.nextCycle?.start_date ?? null)

  const currentCycleStatus = loading
    ? LOADING_LABEL
    : data.activeCycle
      ? data.activeCycle.published
        ? 'Published'
        : 'Draft cycle'
      : 'No active cycle'

  const currentCycleDetail = loading
    ? LOADING_LABEL
    : data.activeCycle
      ? `Publish by ${formatCycleDate(data.activeCycle.end_date)}`
      : 'No current cycle is scheduled.'

  const nextCycleLabel = loading
    ? LOADING_LABEL
    : nextCyclePlanning.collectAvailabilityOn
      ? `Collect availability ${formatCycleDate(nextCyclePlanning.collectAvailabilityOn)}`
      : 'No next cycle'

  const nextCycleDetail = loading
    ? LOADING_LABEL
    : nextCyclePlanning.publishBy
      ? `Publish by ${formatCycleDate(nextCyclePlanning.publishBy)}`
      : 'Create the next 6-week cycle to plan ahead.'

  const needsReviewDetail = loading
    ? LOADING_LABEL
    : data.unreadReviewCount > 0
      ? (data.latestUnreadTitle ?? 'Unread review items are waiting.')
      : 'You are caught up.'

  return (
    <ManagerTriageDashboard
      todayCoverageCovered={loading ? '--' : data.todayCoverageCovered}
      todayCoverageTotal={loading ? '--' : data.todayCoverageTotal}
      upcomingShiftCount={loading ? '--' : data.upcomingShiftCount}
      upcomingShiftDays={loading ? [] : data.upcomingShiftDays}
      todayActiveShifts={loading ? [] : data.todayActiveShifts}
      recentActivity={loading ? [] : data.recentActivity}
      pendingRequests={loading ? '--' : data.pendingApprovals}
      approvalsWaiting={loading ? '--' : data.pendingApprovals}
      currentCycleStatus={currentCycleStatus}
      currentCycleDetail={currentCycleDetail}
      nextCycleLabel={nextCycleLabel}
      nextCycleDetail={nextCycleDetail}
      needsReviewCount={loading ? '--' : data.unreadReviewCount}
      needsReviewDetail={needsReviewDetail}
      dayShiftsFilled={loading ? '--' : data.dayShiftsFilled}
      dayShiftsTotal={loading ? '--' : data.dayShiftsTotal}
      nightShiftsFilled={loading ? '--' : data.nightShiftsFilled}
      nightShiftsTotal={loading ? '--' : data.nightShiftsTotal}
      approvalsHref={MANAGER_WORKFLOW_LINKS.approvals}
      scheduleHref={scheduleHref}
      reviewHref={data.latestUnreadHref}
    />
  )
}
