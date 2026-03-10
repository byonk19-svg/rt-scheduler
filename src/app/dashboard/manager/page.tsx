'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  ClipboardList,
  Send,
  Shield,
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

type MetricValue = number | '--'

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
  cycleStart: '--',
  cycleEnd: '--',
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
        unfilledShifts: '--',
        missingLead: '--',
        underCoverage: '--',
        overCoverage: '--',
        pendingApprovals: '--',
        approvedToday: '--',
        deniedToday: '--',
        activeEmployees: '--',
        dayShift: '--',
        nightShift: '--',
        onFmla: '--',
        scheduledSlots: '--',
        totalSlots: '--',
        therapistsScheduled: '--',
        workloadRows: [],
        cycleStart: '--',
        cycleEnd: '--',
      }
    : data

  const coverageRoute = buildCycleRoute('/coverage', data.activeCycleId)
  const publishRoute = buildCycleRoute('/schedule', data.activeCycleId)
  const approvalsRoute = MANAGER_WORKFLOW_LINKS.approvals
  const teamRoute = MANAGER_WORKFLOW_LINKS.team

  const coverageRisks = [
    {
      label: 'Unfilled shifts',
      value: d.unfilledShifts,
      detail: 'Shifts with no assigned therapist',
      severity: 'error' as const,
    },
    {
      label: 'Missing lead',
      value: d.missingLead,
      detail: 'Shifts without lead therapist coverage',
      severity: 'error' as const,
    },
    {
      label: 'Under coverage',
      value: d.underCoverage,
      detail: 'Shifts below minimum staffing target',
      severity: 'warning' as const,
    },
  ]

  const publishChecklist = [
    {
      label: 'Pending approvals resolved',
      done: typeof d.pendingApprovals === 'number' && d.pendingApprovals === 0,
      detail:
        typeof d.pendingApprovals === 'number'
          ? `${d.pendingApprovals} waiting`
          : 'Loading approval status',
    },
    {
      label: 'Coverage meets minimum staffing',
      done:
        typeof d.unfilledShifts === 'number' &&
        typeof d.underCoverage === 'number' &&
        d.unfilledShifts === 0 &&
        d.underCoverage === 0,
      detail:
        typeof d.unfilledShifts === 'number' && typeof d.underCoverage === 'number'
          ? `${d.unfilledShifts} unfilled, ${d.underCoverage} under-covered`
          : 'Loading coverage checks',
    },
    {
      label: 'Lead assigned on all shifts',
      done: typeof d.missingLead === 'number' && d.missingLead === 0,
      detail:
        typeof d.missingLead === 'number' ? `${d.missingLead} missing lead` : 'Loading lead checks',
    },
    {
      label: 'Cycle reviewed and ready to publish',
      done: !loading && typeof d.scheduledSlots === 'number' && d.scheduledSlots > 0,
      detail:
        typeof d.scheduledSlots === 'number' && typeof d.totalSlots === 'number'
          ? `${d.scheduledSlots} of ${d.totalSlots} slots scheduled`
          : 'Loading cycle progress',
    },
  ]

  const publishReadyCount = publishChecklist.filter((item) => item.done).length
  const publishReadinessPercent = loading
    ? '--'
    : Math.round((publishReadyCount / publishChecklist.length) * 100)

  const unresolvedCoverage = coverageRisks.reduce((total, item) => {
    if (typeof item.value === 'number') return total + item.value
    return total
  }, 0)

  const pendingTeamMembers =
    typeof d.activeEmployees === 'number' && typeof d.therapistsScheduled === 'number'
      ? Math.max(d.activeEmployees - d.therapistsScheduled, 0)
      : '--'

  const nextAction = loading
    ? {
        title: 'Loading cycle health',
        detail: 'Pulling live staffing, approvals, and publish readiness data.',
        href: coverageRoute,
        cta: 'Open coverage',
      }
    : unresolvedCoverage > 0
      ? {
          title: 'Fix coverage gaps before publishing',
          detail: `${unresolvedCoverage} total unresolved staffing blockers across this cycle.`,
          href: coverageRoute,
          cta: 'Fix coverage',
        }
      : typeof d.pendingApprovals === 'number' && d.pendingApprovals > 0
        ? {
            title: 'Review pending approvals',
            detail: `${d.pendingApprovals} approval requests are waiting for decision.`,
            href: approvalsRoute,
            cta: 'Review approvals',
          }
        : {
            title: 'Publish schedule',
            detail: 'Coverage and approvals are in good shape. Proceed to publish.',
            href: publishRoute,
            cta: 'Go to publish',
          }

  function getGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card px-5 py-5 shadow-[0_2px_18px_rgba(15,23,42,0.06)] md:px-6 md:py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {getGreeting()}, {d.managerName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {d.cycleStart} - {d.cycleEnd}
              </span>
              <SeverityBadge
                tone={
                  typeof unresolvedCoverage === 'number' && unresolvedCoverage > 0 ? 'error' : 'ok'
                }
                label={
                  loading
                    ? 'Loading coverage'
                    : unresolvedCoverage > 0
                      ? `${unresolvedCoverage} coverage gaps`
                      : 'Coverage clear'
                }
              />
              <SeverityBadge
                tone={
                  typeof d.pendingApprovals === 'number' && d.pendingApprovals > 0
                    ? 'warning'
                    : 'ok'
                }
                label={
                  loading
                    ? 'Loading approvals'
                    : typeof d.pendingApprovals === 'number' && d.pendingApprovals > 0
                      ? `${d.pendingApprovals} pending approvals`
                      : 'Approvals clear'
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push(coverageRoute)}>
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
              Open coverage
            </Button>
            <Button size="sm" onClick={() => router.push(nextAction.href)}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {nextAction.cta}
            </Button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-muted/35 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{nextAction.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{nextAction.detail}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Coverage issues"
          value={loading ? '--' : unresolvedCoverage}
          subtitle={
            loading
              ? 'Loading staffing diagnostics'
              : `${formatMetric(d.missingLead)} missing lead, ${formatMetric(d.underCoverage)} under coverage`
          }
          icon={<Shield className="h-4 w-4" />}
          tone={loading || unresolvedCoverage > 0 ? 'error' : 'ok'}
          onClick={() => router.push(coverageRoute)}
        />
        <MetricCard
          title="Pending approvals"
          value={d.pendingApprovals}
          subtitle={
            loading
              ? 'Loading approval inbox'
              : `${formatMetric(d.approvedToday)} approved today, ${formatMetric(d.deniedToday)} denied`
          }
          icon={<ClipboardList className="h-4 w-4" />}
          tone={typeof d.pendingApprovals === 'number' && d.pendingApprovals > 0 ? 'warning' : 'ok'}
          onClick={() => router.push(approvalsRoute)}
        />
        <MetricCard
          title="Availability received"
          value={
            loading ||
            typeof d.activeEmployees !== 'number' ||
            typeof d.therapistsScheduled !== 'number'
              ? '--'
              : `${d.therapistsScheduled}/${d.activeEmployees}`
          }
          subtitle={
            loading
              ? 'Loading therapist responses'
              : `${formatMetric(pendingTeamMembers)} still pending response`
          }
          icon={<Users className="h-4 w-4" />}
          tone="default"
          onClick={() => router.push(teamRoute)}
        />
        <MetricCard
          title="Publish readiness"
          value={publishReadinessPercent}
          valueSuffix={publishReadinessPercent === '--' ? '' : '%'}
          subtitle={
            loading
              ? 'Loading readiness checks'
              : `${publishReadyCount}/${publishChecklist.length} checks complete`
          }
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone={
            typeof publishReadinessPercent === 'number' && publishReadinessPercent >= 75
              ? 'ok'
              : 'warning'
          }
          onClick={() => router.push(publishRoute)}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionPanel className="xl:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--error-text)]" />
              <h2 className="text-sm font-semibold text-foreground">Coverage risks</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => router.push(coverageRoute)}
            >
              Resolve coverage
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="divide-y divide-border">
            {coverageRisks.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  {item.severity === 'error' ? (
                    <AlertTriangle className="h-4 w-4 text-[var(--error-text)]" />
                  ) : (
                    <Clock className="h-4 w-4 text-[var(--warning-text)]" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
                <SeverityBadge
                  tone={
                    loading
                      ? 'warning'
                      : typeof item.value === 'number' && item.value > 0
                        ? item.severity
                        : 'ok'
                  }
                  label={loading ? '--' : `${item.value}`}
                />
              </div>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel>
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Cycle progress</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Live scheduling progress for this cycle
            </p>
          </div>
          <div className="px-5 pb-5">
            <ProgressMeter
              scheduled={loading ? null : data.scheduledSlots}
              total={loading ? null : data.totalSlots}
            />
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Scheduled slots</span>
                <span className="font-semibold text-foreground">
                  {loading ? '--' : `${d.scheduledSlots}/${d.totalSlots}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Therapists on cycle</span>
                <span className="font-semibold text-foreground">{d.therapistsScheduled}</span>
              </div>
            </div>
            <Button className="mt-4 w-full" size="sm" onClick={() => router.push(publishRoute)}>
              Continue to publish
            </Button>
          </div>
        </SectionPanel>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionPanel>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Approval snapshot</h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => router.push(approvalsRoute)}
            >
              Review all
            </Button>
          </div>
          <div className="space-y-2 px-5 py-4">
            <ChecklistRow
              label="Pending requests"
              done={typeof d.pendingApprovals === 'number' && d.pendingApprovals === 0}
              detail={loading ? '--' : `${d.pendingApprovals} waiting`}
            />
            <ChecklistRow label="Approved today" done detail={formatMetric(d.approvedToday)} />
            <ChecklistRow
              label="Denied today"
              done={typeof d.deniedToday === 'number' && d.deniedToday === 0}
              detail={formatMetric(d.deniedToday)}
            />
          </div>
        </SectionPanel>

        <SectionPanel className="xl:col-span-2">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Publish readiness checklist</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Clear these items to publish the next cycle safely.
            </p>
          </div>
          <div className="space-y-3 px-5 py-5">
            {publishChecklist.map((item) => (
              <ChecklistRow
                key={item.label}
                label={item.label}
                done={item.done}
                detail={item.detail}
              />
            ))}
          </div>
        </SectionPanel>
      </section>
    </div>
  )
}

function SectionPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
        className
      )}
    >
      {children}
    </section>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone,
  valueSuffix,
  onClick,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: ReactNode
  tone: 'default' | 'warning' | 'error' | 'ok'
  valueSuffix?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border bg-card px-4 py-4 text-left shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-colors hover:bg-muted/25"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <span
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md',
            tone === 'error' && 'bg-[var(--error-subtle)] text-[var(--error-text)]',
            tone === 'warning' && 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
            tone === 'ok' && 'bg-[var(--success-subtle)] text-[var(--success-text)]',
            tone === 'default' && 'bg-muted text-muted-foreground'
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        {value}
        {valueSuffix}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </button>
  )
}

function SeverityBadge({ tone, label }: { tone: 'warning' | 'error' | 'ok'; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
        tone === 'error' && 'bg-[var(--error-subtle)] text-[var(--error-text)]',
        tone === 'warning' && 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
        tone === 'ok' && 'bg-[var(--success-subtle)] text-[var(--success-text)]'
      )}
    >
      {label}
    </span>
  )
}

function ChecklistRow({ label, done, detail }: { label: string; done: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/25 px-3 py-2.5">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success-text)]" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning-text)]" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm',
            done ? 'text-muted-foreground line-through' : 'font-medium text-foreground'
          )}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}

function ProgressMeter({ scheduled, total }: { scheduled: number | null; total: number | null }) {
  if (scheduled === null || total === null || total <= 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/35 px-3 py-2.5 text-xs text-muted-foreground">
        Loading cycle progress.
      </div>
    )
  }

  const percentage = Math.round((scheduled / total) * 100)
  const meterColor =
    percentage >= 80 ? 'var(--success)' : percentage >= 60 ? 'var(--warning)' : 'var(--error)'

  return (
    <div>
      <p className="text-xs font-semibold text-foreground">
        {scheduled} of {total} slots scheduled ({percentage}%)
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${percentage}%`, background: meterColor }}
        />
      </div>
    </div>
  )
}

function formatMetric(value: string | number): string {
  return typeof value === 'number' ? String(value) : value
}
