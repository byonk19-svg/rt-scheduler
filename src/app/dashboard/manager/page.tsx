'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { Cycle } from '@/app/schedule/types'
import { ManagerTriageDashboard } from '@/components/manager/ManagerTriageDashboard'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { buildCycleRoute } from '@/lib/cycle-route'
import { getNextCyclePlanningWindow } from '@/lib/manager-inbox'
import { createClient } from '@/lib/supabase/client'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

type DashboardData = {
  pendingApprovals: number
  activeCycle: Cycle | null
  nextCycle: Cycle | null
  unreadReviewCount: number
  latestUnreadTitle: string | null
  latestUnreadHref: string
}

type ManagerProfileRow = {
  role: string | null
}

type NotificationRow = {
  event_type: string
  title: string
  target_type: 'schedule_cycle' | 'shift' | 'shift_post' | 'system' | null
}

const INITIAL_DATA: DashboardData = {
  pendingApprovals: 0,
  activeCycle: null,
  nextCycle: null,
  unreadReviewCount: 0,
  latestUnreadTitle: null,
  latestUnreadHref: '/coverage?view=week',
}

function formatCycleDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

        const todayKey = new Date().toISOString().slice(0, 10)

        const [
          profileResult,
          cyclesResult,
          pendingApprovalsResult,
          unreadReviewCountResult,
          latestUnreadResult,
        ] = await Promise.all([
          supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
          supabase
            .from('schedule_cycles')
            .select('id, label, start_date, end_date, published')
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
        ])

        if (profileResult.error) {
          console.error('Failed to load manager profile for dashboard:', profileResult.error)
        }
        if (cyclesResult.error) {
          console.error('Failed to load cycles for manager inbox:', cyclesResult.error)
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
    ? 'Loading'
    : data.activeCycle
      ? data.activeCycle.published
        ? 'Published'
        : 'Draft cycle'
      : 'No active cycle'

  const currentCycleDetail = loading
    ? 'Loading'
    : data.activeCycle
      ? `Publish by ${formatCycleDate(data.activeCycle.end_date)}`
      : 'No current cycle is scheduled.'

  const nextCycleLabel = loading
    ? 'Loading'
    : nextCyclePlanning.collectAvailabilityOn
      ? `Collect availability ${formatCycleDate(nextCyclePlanning.collectAvailabilityOn)}`
      : 'No next cycle'

  const nextCycleDetail = loading
    ? 'Loading'
    : nextCyclePlanning.publishBy
      ? `Publish by ${formatCycleDate(nextCyclePlanning.publishBy)}`
      : 'Create the next 6-week cycle to plan ahead.'

  const needsReviewDetail = loading
    ? 'Loading'
    : data.unreadReviewCount > 0
      ? (data.latestUnreadTitle ?? 'Unread review items are waiting.')
      : 'You are caught up.'

  return (
    <ManagerTriageDashboard
      approvalsWaiting={loading ? '--' : data.pendingApprovals}
      currentCycleStatus={currentCycleStatus}
      currentCycleDetail={currentCycleDetail}
      nextCycleLabel={nextCycleLabel}
      nextCycleDetail={nextCycleDetail}
      needsReviewCount={loading ? '--' : data.unreadReviewCount}
      needsReviewDetail={needsReviewDetail}
      approvalsHref={MANAGER_WORKFLOW_LINKS.approvals}
      scheduleHref={scheduleHref}
      reviewHref={data.latestUnreadHref}
      onNavigate={(href) => router.push(href)}
    />
  )
}
