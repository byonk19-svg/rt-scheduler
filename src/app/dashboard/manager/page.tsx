'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  Moon,
  Rocket,
  SquareCheckBig,
  Sun,
  Users,
  XCircle,
} from 'lucide-react'

import type { Cycle, ShiftRole, ShiftStatus } from '@/app/schedule/types'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { buildDateRange, dateKeyFromDate } from '@/lib/schedule-helpers'
import { MAX_SHIFT_COVERAGE_PER_DAY, MIN_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import { createClient } from '@/lib/supabase/client'
import { buildCycleRoute } from '@/lib/cycle-route'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

type DashboardData = {
  unfilledShifts: number
  missingLead: number
  underCoverage: number
  overCoverage: number
  pendingApprovals: number
  approvedToday: number
  deniedToday: number
  activeEmployees: number
  dayShift: number
  nightShift: number
  onFmla: number
  scheduledSlots: number
  totalSlots: number
  therapistsScheduled: number
  workloadRows: WorkloadRow[]
  weeklyProgress: WeekRow[]
  cycleStart: string
  cycleEnd: string
  managerName: string
  activeCycleId: string | null
}

type MetricValue = number | '—'

type DashboardDisplayData = {
  unfilledShifts: MetricValue
  missingLead: MetricValue
  underCoverage: MetricValue
  overCoverage: MetricValue
  pendingApprovals: MetricValue
  approvedToday: MetricValue
  deniedToday: MetricValue
  activeEmployees: MetricValue
  dayShift: MetricValue
  nightShift: MetricValue
  onFmla: MetricValue
  scheduledSlots: MetricValue
  totalSlots: MetricValue
  therapistsScheduled: MetricValue
  workloadRows: WorkloadRow[]
  weeklyProgress: WeekRow[]
  cycleStart: string
  cycleEnd: string
  managerName: string
  activeCycleId: string | null
}

type ManagerProfileRow = {
  full_name: string | null
  role: string | null
}

type TeamProfileRow = {
  id: string
  full_name: string | null
  shift_type: 'day' | 'night' | null
  is_active: boolean | null
  on_fmla: boolean | null
}

type WorkloadRow = { id: string; name: string; shiftType: 'day' | 'night'; count: number }
type WeekRow = { label: string; scheduled: number; total: number }

type ShiftCoverageRow = {
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  role: ShiftRole
  user_id: string | null
}

type ShiftPostRow = {
  shift_id: string | null
  status?: 'approved' | 'denied'
}

type ShiftPublishedLookupRow = {
  id: string
  schedule_cycles: { published: boolean } | { published: boolean }[] | null
}

const INITIAL_DATA: DashboardData = {
  unfilledShifts: 0,
  missingLead: 0,
  underCoverage: 0,
  overCoverage: 0,
  pendingApprovals: 0,
  approvedToday: 0,
  deniedToday: 0,
  activeEmployees: 0,
  dayShift: 0,
  nightShift: 0,
  onFmla: 0,
  scheduledSlots: 0,
  totalSlots: 0,
  therapistsScheduled: 0,
  workloadRows: [],
  weeklyProgress: [],
  cycleStart: '—',
  cycleEnd: '—',
  managerName: 'Manager',
  activeCycleId: null,
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function formatCycleDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function countsTowardCoverage(status: ShiftStatus): boolean {
  return status === 'scheduled' || status === 'on_call'
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
        const todayKey = dateKeyFromDate(today)
        const fallbackEndKey = dateKeyFromDate(addDays(today, 42))
        const todayStart = new Date(today)
        todayStart.setHours(0, 0, 0, 0)

        const [profileResult, activeCycleResult] = await Promise.all([
          supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle(),
          supabase
            .from('schedule_cycles')
            .select('id, label, start_date, end_date, published')
            .lte('start_date', todayKey)
            .gte('end_date', todayKey)
            .order('start_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

        if (profileResult.error) {
          console.error('Failed to load manager profile for dashboard:', profileResult.error)
        }

        if (activeCycleResult.error) {
          console.error(
            'Failed to load current schedule cycle for dashboard. Falling back to a 6-week window:',
            activeCycleResult.error
          )
        }

        const profile = (profileResult.data ?? null) as ManagerProfileRow | null

        if (!can(parseRole(profile?.role), 'access_manager_ui')) {
          router.replace('/dashboard/staff')
          return
        }

        const managerName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Manager'
        const activeCycle = ((activeCycleResult.data ?? null) as Cycle | null) ?? null
        const cycleStartDate = activeCycle?.start_date ?? todayKey
        const cycleEndDate = activeCycle?.end_date ?? fallbackEndKey

        let shiftsQuery = supabase
          .from('shifts')
          .select('date, shift_type, status, role, user_id')
          .gte('date', cycleStartDate)
          .lte('date', cycleEndDate)

        if (activeCycle?.id) {
          shiftsQuery = shiftsQuery.eq('cycle_id', activeCycle.id)
        }

        const [teamProfilesResult, pendingPostsResult, reviewedPostsResult, shiftsResult] =
          await Promise.all([
            supabase
              .from('profiles')
              .select('id, full_name, shift_type, is_active, on_fmla')
              .in('role', ['therapist', 'staff']),
            supabase.from('shift_posts').select('shift_id').eq('status', 'pending'),
            supabase
              .from('shift_posts')
              .select('shift_id, status')
              .in('status', ['approved', 'denied'])
              .gte('created_at', todayStart.toISOString()),
            shiftsQuery,
          ])

        if (teamProfilesResult.error) {
          console.error(
            'Failed to load team profile metrics for dashboard:',
            teamProfilesResult.error
          )
        }
        if (pendingPostsResult.error) {
          console.error(
            'Failed to load pending approval posts for dashboard:',
            pendingPostsResult.error
          )
        }
        if (reviewedPostsResult.error) {
          console.error('Failed to load reviewed posts for dashboard:', reviewedPostsResult.error)
        }
        if (shiftsResult.error) {
          console.error('Failed to load shifts for dashboard metrics:', shiftsResult.error)
        }

        let unfilledShifts = 0
        let missingLead = 0
        let underCoverage = 0
        let overCoverage = 0
        let scheduledSlots = 0
        let totalSlots = 0
        const scheduledUserIds = new Set<string>()

        const shifts = shiftsResult.error ? [] : ((shiftsResult.data ?? []) as ShiftCoverageRow[])
        const shiftsBySlot = new Map<string, ShiftCoverageRow[]>()

        for (const shift of shifts) {
          const slotKey = `${shift.date}:${shift.shift_type}`
          const rows = shiftsBySlot.get(slotKey) ?? []
          rows.push(shift)
          shiftsBySlot.set(slotKey, rows)
        }

        let dateIndex = 0
        const weeklyBuckets = new Map<
          number,
          { scheduled: number; total: number; startDate: string }
        >()

        for (const date of buildDateRange(cycleStartDate, cycleEndDate)) {
          const weekIndex = Math.floor(dateIndex / 7)
          for (const shiftType of ['day', 'night'] as const) {
            const slotKey = `${date}:${shiftType}`
            const slotRows = shiftsBySlot.get(slotKey) ?? []
            const activeRows = slotRows.filter((row) => countsTowardCoverage(row.status))
            const assignedRows = activeRows.filter((row) => Boolean(row.user_id))
            const coverageCount = assignedRows.length
            const leadCount = assignedRows.filter((row) => row.role === 'lead').length

            totalSlots += 1
            if (coverageCount > 0) scheduledSlots += 1
            for (const row of assignedRows) {
              if (row.user_id) scheduledUserIds.add(row.user_id)
            }

            if (coverageCount === 0) unfilledShifts += 1
            if (leadCount === 0) missingLead += 1
            if (coverageCount < MIN_SHIFT_COVERAGE_PER_DAY) underCoverage += 1
            if (coverageCount > MAX_SHIFT_COVERAGE_PER_DAY) overCoverage += 1

            const weekBucket = weeklyBuckets.get(weekIndex) ?? {
              scheduled: 0,
              total: 0,
              startDate: date,
            }
            weekBucket.total += 1
            if (coverageCount > 0) weekBucket.scheduled += 1
            weeklyBuckets.set(weekIndex, weekBucket)
          }
          dateIndex += 1
        }

        const weeklyProgress: WeekRow[] = Array.from(weeklyBuckets.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([, bucket]) => ({
            label: formatCycleDate(bucket.startDate),
            scheduled: bucket.scheduled,
            total: bucket.total,
          }))

        const therapistsScheduled = scheduledUserIds.size

        const shiftCountsByUser = new Map<string, number>()
        for (const shift of shifts) {
          if (!shift.user_id || !countsTowardCoverage(shift.status)) continue
          shiftCountsByUser.set(shift.user_id, (shiftCountsByUser.get(shift.user_id) ?? 0) + 1)
        }

        const pendingPosts = pendingPostsResult.error
          ? []
          : ((pendingPostsResult.data ?? []) as ShiftPostRow[])
        const reviewedPosts = reviewedPostsResult.error
          ? []
          : ((reviewedPostsResult.data ?? []) as ShiftPostRow[])

        const shiftIds = Array.from(
          new Set(
            [...pendingPosts, ...reviewedPosts]
              .map((row) => row.shift_id)
              .filter((value): value is string => Boolean(value))
          )
        )

        let publishedShiftIds: Set<string> | null = new Set<string>()

        if (shiftIds.length > 0) {
          const { data: publishedLookup, error: publishedLookupError } = await supabase
            .from('shifts')
            .select('id, schedule_cycles!inner(published)')
            .in('id', shiftIds)

          if (publishedLookupError) {
            console.error(
              'Failed to scope approval metrics to published cycles:',
              publishedLookupError
            )
            publishedShiftIds = null
          } else {
            publishedShiftIds = new Set(
              ((publishedLookup ?? []) as ShiftPublishedLookupRow[])
                .filter((row) => Boolean(getOne(row.schedule_cycles)?.published))
                .map((row) => row.id)
            )
          }
        }

        const pendingApprovals =
          publishedShiftIds === null
            ? pendingPosts.length
            : pendingPosts.filter((row) => row.shift_id && publishedShiftIds.has(row.shift_id))
                .length

        const approvedToday = reviewedPosts.filter(
          (row) =>
            row.status === 'approved' &&
            (publishedShiftIds === null ||
              (row.shift_id !== null && publishedShiftIds.has(row.shift_id)))
        ).length

        const deniedToday = reviewedPosts.filter(
          (row) =>
            row.status === 'denied' &&
            (publishedShiftIds === null ||
              (row.shift_id !== null && publishedShiftIds.has(row.shift_id)))
        ).length

        const teamProfiles = teamProfilesResult.error
          ? []
          : ((teamProfilesResult.data ?? []) as TeamProfileRow[])
        const activeTeamProfiles = teamProfiles.filter((row) => row.is_active !== false)

        const activeEmployees = activeTeamProfiles.length
        const dayShift = activeTeamProfiles.filter((row) => row.shift_type === 'day').length
        const nightShift = activeTeamProfiles.filter((row) => row.shift_type === 'night').length
        const onFmla = activeTeamProfiles.filter((row) => row.on_fmla === true).length

        const workloadRows: WorkloadRow[] = activeTeamProfiles
          .map((p) => ({
            id: p.id,
            name: p.full_name ?? 'Unknown',
            shiftType: (p.shift_type ?? 'day') as 'day' | 'night',
            count: shiftCountsByUser.get(p.id) ?? 0,
          }))
          .filter((row) => row.count > 0)
          .sort((a, b) => b.count - a.count)

        if (!isMounted) return

        setData({
          unfilledShifts,
          missingLead,
          underCoverage,
          overCoverage,
          pendingApprovals,
          approvedToday,
          deniedToday,
          activeEmployees,
          dayShift,
          nightShift,
          onFmla,
          scheduledSlots,
          totalSlots,
          therapistsScheduled,
          workloadRows,
          weeklyProgress,
          cycleStart: formatCycleDate(cycleStartDate),
          cycleEnd: formatCycleDate(cycleEndDate),
          managerName,
          activeCycleId: activeCycle?.id ?? null,
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

  const d: DashboardDisplayData = loading
    ? {
        ...data,
        unfilledShifts: '—',
        missingLead: '—',
        underCoverage: '—',
        overCoverage: '—',
        pendingApprovals: '—',
        approvedToday: '—',
        deniedToday: '—',
        activeEmployees: '—',
        dayShift: '—',
        nightShift: '—',
        onFmla: '—',
        scheduledSlots: '—',
        totalSlots: '—',
        therapistsScheduled: '—',
        workloadRows: [],
        cycleStart: '—',
        cycleEnd: '—',
      }
    : data

  const coverageRoute = buildCycleRoute('/coverage', data.activeCycleId)
  const publishRoute = buildCycleRoute('/schedule', data.activeCycleId)
  const approvalsRoute = MANAGER_WORKFLOW_LINKS.approvals
  const teamRoute = MANAGER_WORKFLOW_LINKS.team

  const approvalsClear = !loading && data.pendingApprovals === 0
  const coverageHasIssues = !loading && data.underCoverage > 0
  const leadHasIssues = !loading && data.missingLead > 0
  const hasAnyIssues =
    loading ||
    !approvalsClear ||
    coverageHasIssues ||
    leadHasIssues ||
    (!loading && data.unfilledShifts > 0)
  const nextAction = (() => {
    if (loading) {
      return {
        title: 'Review cycle health',
        detail: 'Loading live coverage and approval signals for this cycle.',
        href: coverageRoute,
        cta: 'Open coverage',
        tone: 'warn' as const,
      }
    }

    if (data.unfilledShifts > 0 || leadHasIssues || coverageHasIssues) {
      const issues: string[] = []
      if (data.unfilledShifts > 0) issues.push(`${data.unfilledShifts} unfilled`)
      if (data.missingLead > 0) issues.push(`${data.missingLead} missing lead`)
      if (data.underCoverage > 0) issues.push(`${data.underCoverage} under coverage`)
      return {
        title: 'Fix coverage before publishing',
        detail: `${issues.join(' | ')}.`,
        href: coverageRoute,
        cta: 'Resolve coverage gaps',
        tone: 'critical' as const,
      }
    }

    if (!approvalsClear) {
      return {
        title: 'Clear pending approvals',
        detail: `${data.pendingApprovals} requests are still waiting for review.`,
        href: approvalsRoute,
        cta: 'Review approvals',
        tone: 'warn' as const,
      }
    }

    return {
      title: 'Cycle is ready to publish',
      detail: 'Coverage and approvals are clear for this cycle.',
      href: publishRoute,
      cta: 'Go to publish',
      tone: 'ok' as const,
    }
  })()
  const publishBlockers = (() => {
    if (loading) return []
    const blockers: string[] = []
    if (data.unfilledShifts > 0) {
      blockers.push(`${data.unfilledShifts} unfilled shift${data.unfilledShifts === 1 ? '' : 's'}`)
    }
    if (data.missingLead > 0) {
      blockers.push(`${data.missingLead} shift${data.missingLead === 1 ? '' : 's'} missing lead`)
    }
    if (data.underCoverage > 0) {
      blockers.push(
        `${data.underCoverage} under-coverage slot${data.underCoverage === 1 ? '' : 's'}`
      )
    }
    if (data.pendingApprovals > 0) {
      blockers.push(
        `${data.pendingApprovals} pending approval${data.pendingApprovals === 1 ? '' : 's'}`
      )
    }
    return blockers
  })()
  const publishBlockedReason = loading
    ? 'Checking publish blockers.'
    : publishBlockers.length > 0
      ? `Blocked by ${publishBlockers.join(', ')}.`
      : 'No blockers detected. Cycle can be published.'

  return (
    <div className="space-y-5">
      {/* Page header */}
      <PageHeader
        className="fade-up"
        title="Manager Dashboard"
        subtitle={`Welcome, ${d.managerName}. Build coverage first, then publish confidently.`}
        actions={
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">
              {d.cycleStart} – {d.cycleEnd}
            </span>
          </div>
        }
      />

      {/* Attention bar */}
      <div
        className={cn(
          'fade-up flex flex-wrap items-center gap-4 rounded-xl border bg-card px-4 py-4 sm:gap-5 sm:px-5',
          hasAnyIssues
            ? 'border-l-4 border-[var(--warning-border)] border-l-[var(--warning)]'
            : 'border-l-4 border-[var(--success-border)] border-l-[var(--success)]'
        )}
        style={{ animationDelay: '0.05s' }}
      >
        <div className="flex flex-1 flex-wrap gap-4 sm:gap-5">
          <Stat label="Unfilled shifts" value={d.unfilledShifts} color="var(--error-text)" />
          <div className="hidden w-px self-stretch bg-border sm:block" />
          <Stat label="Missing lead" value={d.missingLead} color="var(--error-text)" />
          <div className="hidden w-px self-stretch bg-border sm:block" />
          <Stat label="Under coverage" value={d.underCoverage} color="var(--warning-text)" />
          <div className="hidden w-px self-stretch bg-border sm:block" />
          <Stat label="Pending approvals" value={d.pendingApprovals} color="var(--success-text)" />
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" onClick={() => router.push(coverageRoute)}>
            Fix coverage
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.push(approvalsRoute)}>
            Review approvals
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.push(publishRoute)}>
            Go to publish
          </Button>
        </div>
      </div>

      {/* Primary workflow panels */}
      <div
        className="fade-up grid grid-cols-1 gap-3.5 lg:grid-cols-12"
        style={{ animationDelay: '0.1s' }}
      >
        <SectionCard className="lg:col-span-7">
          <CardHeader
            icon={<Rocket className="h-4 w-4 text-muted-foreground" />}
            title="Next action"
            subtitle="Start with the highest-impact step for this cycle"
          />
          <div
            className={cn(
              'my-3.5 rounded-lg border px-3 py-3',
              nextAction.tone === 'critical'
                ? 'border-[var(--error-border)] bg-[var(--error-subtle)]'
                : nextAction.tone === 'warn'
                  ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)]'
                  : 'border-[var(--success-border)] bg-[var(--success-subtle)]'
            )}
          >
            <p className="text-sm font-bold text-foreground">{nextAction.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{nextAction.detail}</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            <SmallTile
              label="Slots scheduled"
              value={loading ? '—' : `${String(d.scheduledSlots)} / ${String(d.totalSlots)}`}
              icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
            />
            <SmallTile
              label="Therapists on cycle"
              value={d.therapistsScheduled}
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
            />
            <SmallTile
              label="Approved today"
              value={d.approvedToday}
              icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
            />
            <SmallTile
              label="Denied today"
              value={d.deniedToday}
              icon={<XCircle className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => router.push(nextAction.href)}>
              {nextAction.cta}
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.push(coverageRoute)}>
              Open coverage
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.push(approvalsRoute)}>
              Open approvals
            </Button>
          </div>
        </SectionCard>

        <div className="grid gap-3.5 lg:col-span-5">
          <SectionCard>
            <CardHeader
              icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
              title="Coverage diagnostics"
              subtitle="Resolve gaps before publishing"
            />
            <div className="my-3.5 flex flex-col gap-2">
              <IssueRow label="Missing lead" value={d.missingLead} type="error" />
              <IssueRow label="Under coverage" value={d.underCoverage} type="warn" />
              <IssueRow label="Over coverage" value={d.overCoverage} type="ok" />
            </div>
            <Button size="sm" className="w-full" onClick={() => router.push(coverageRoute)}>
              Open coverage
            </Button>
          </SectionCard>

          <SectionCard>
            <CardHeader
              icon={<SquareCheckBig className="h-4 w-4 text-muted-foreground" />}
              title="Approvals and publish"
              subtitle="Review requests and confirm publish readiness"
            />
            <div className="my-3.5 flex flex-col gap-2">
              <CheckRow
                label="Pending"
                status={approvalsClear ? 'ok' : 'error'}
                detail={loading ? '—' : `${data.pendingApprovals} waiting`}
              />
              <CheckRow label="Approved today" status="ok" detail={String(d.approvedToday)} />
              <CheckRow label="Denied today" status="ok" detail={String(d.deniedToday)} />
              <CheckRow
                label="Publish ready"
                status={hasAnyIssues ? 'error' : 'ok'}
                detail={loading ? '—' : hasAnyIssues ? 'blocked' : 'ready'}
              />
              {!loading && (
                <p
                  className={cn(
                    'hidden lg:block text-xs',
                    publishBlockers.length > 0
                      ? 'text-[var(--warning-text)]'
                      : 'text-[var(--success-text)]'
                  )}
                >
                  {publishBlockedReason}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => router.push(approvalsRoute)}
              >
                Open approvals
              </Button>
              <Button size="sm" className="flex-1" onClick={() => router.push(publishRoute)}>
                Go to publish
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Cycle progress */}
      <SectionCard className="fade-up" style={{ animationDelay: '0.15s' }}>
        <p className="mb-3 text-sm font-semibold text-foreground">Cycle progress</p>
        <FillRateBar
          scheduled={loading ? null : data.scheduledSlots}
          total={loading ? null : data.totalSlots}
        />
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <SmallTile
            label="Slots scheduled"
            value={loading ? '—' : `${String(d.scheduledSlots)} / ${String(d.totalSlots)}`}
            icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          />
          <SmallTile
            label="Therapists on cycle"
            value={d.therapistsScheduled}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
        {!loading && data.weeklyProgress.length > 0 && (
          <div className="mt-3.5">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Week by week</p>
            <div className="flex flex-col gap-1">
              {data.weeklyProgress.map((week) => {
                const pct = week.total > 0 ? Math.round((week.scheduled / week.total) * 100) : 0
                const barColor =
                  pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--error)'
                return (
                  <div key={week.label} className="flex items-center gap-2.5">
                    <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground">
                      {week.label}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-[width] duration-300 ease-out"
                        style={{ width: `${String(pct)}%`, background: barColor }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-xs font-bold text-foreground">
                      {week.scheduled}/{week.total}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </SectionCard>

      {/* Workload distribution */}
      <SectionCard className="fade-up" style={{ animationDelay: '0.2s' }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Workload distribution</p>
          <span className="text-xs text-muted-foreground">shifts this cycle · per therapist</span>
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : data.workloadRows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No scheduled shifts yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {data.workloadRows.map((row) => (
              <WorkloadBar key={row.id} row={row} max={data.workloadRows[0]?.count ?? 1} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Team summary */}
      <SectionCard className="fade-up" style={{ animationDelay: '0.25s' }}>
        <div className="mb-3.5 flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Team summary</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Directory management on the Team page.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => router.push(teamRoute)}>
            Manage team
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {(
            [
              {
                label: 'Active employees',
                value: d.activeEmployees,
                icon: <Users className="h-4 w-4 text-muted-foreground" />,
              },
              {
                label: 'Day shift',
                value: d.dayShift,
                icon: <Sun className="h-4 w-4 text-muted-foreground" />,
              },
              {
                label: 'Night shift',
                value: d.nightShift,
                icon: <Moon className="h-4 w-4 text-muted-foreground" />,
              },
              {
                label: 'On FMLA',
                value: d.onFmla,
                icon: <FileText className="h-4 w-4 text-muted-foreground" />,
              },
            ] as { label: string; value: string | number; icon: ReactNode }[]
          ).map(({ label, value, icon }) => (
            <SmallTile key={label} label={label} value={value} icon={icon} />
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

// Sub-components

function SectionCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className
      )}
      style={style}
    >
      {children}
    </div>
  )
}

function CardHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border pb-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
        {icon}
      </div>
      <div>
        <p className="text-[13px] font-bold leading-none text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[22px] font-bold leading-none" style={{ color }}>
        {value}
      </span>
      <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  )
}

function IssueRow({
  label,
  value,
  type,
}: {
  label: string
  value: number | string
  type: 'error' | 'warn' | 'ok'
}) {
  const color =
    type === 'error'
      ? 'var(--error-text)'
      : type === 'warn'
        ? 'var(--warning-text)'
        : 'var(--success-text)'
  const bg =
    type === 'error'
      ? 'var(--error-subtle)'
      : type === 'warn'
        ? 'var(--warning-subtle)'
        : 'var(--success-subtle)'

  return (
    <div className="flex items-center justify-between rounded-lg bg-muted px-2.5 py-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span
        className="rounded-full px-2 py-0.5 text-xs font-bold"
        style={{ color, background: bg }}
      >
        {value}
      </span>
    </div>
  )
}

function CheckRow({
  label,
  status,
  detail,
}: {
  label: string
  status: 'ok' | 'error'
  detail: string
}) {
  const isOk = status === 'ok'
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5">
      {isOk ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--success-text)]" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-[var(--error-text)]" />
      )}
      <span className="min-w-[70px] text-xs font-semibold text-foreground">{label}</span>
      <span
        className="ml-auto text-right text-xs font-semibold"
        style={{ color: isOk ? 'var(--success-text)' : 'var(--error-text)' }}
      >
        {detail}
      </span>
    </div>
  )
}

function FillRateBar({ scheduled, total }: { scheduled: number | null; total: number | null }) {
  if (scheduled === null || total === null || total === 0) {
    return (
      <p className="text-xs font-medium text-muted-foreground">
        {total === 0 ? 'No slots in cycle' : '—'}
      </p>
    )
  }
  const pct = Math.round((scheduled / total) * 100)
  const barColor = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--error)'
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-foreground">
        {scheduled} of {total} slots scheduled ({pct}%)
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${String(pct)}%`, background: barColor }}
        />
      </div>
    </div>
  )
}

function WorkloadBar({ row, max }: { row: WorkloadRow; max: number }) {
  const pct = max > 0 ? Math.round((row.count / max) * 100) : 0
  const barColor = row.shiftType === 'day' ? 'var(--primary)' : 'var(--tw-deep-blue)'
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-36 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-foreground">
        {row.name}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${String(pct)}%`, background: barColor }}
        />
      </div>
      <span className="w-7 shrink-0 text-right text-xs font-bold text-foreground">{row.count}</span>
    </div>
  )
}

function SmallTile({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-muted p-3">
      <div className="mb-1">{icon}</div>
      <div className="text-[22px] font-bold leading-none text-foreground">{value}</div>
      <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
    </div>
  )
}
