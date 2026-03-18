'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileCheck,
  Send,
  Shield,
  Users,
} from 'lucide-react'
import { motion } from 'framer-motion'

import type { Cycle, ShiftRole, ShiftStatus } from '@/app/schedule/types'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { buildDateRange, dateKeyFromDate } from '@/lib/schedule-helpers'
import { MAX_SHIFT_COVERAGE_PER_DAY, MIN_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import { createClient } from '@/lib/supabase/client'
import { buildCycleRoute } from '@/lib/cycle-route'
import { Button } from '@/components/ui/button'
import { StatsCard } from '@/components/ui/stats-card'
import { ScheduleProgress } from '@/components/ui/schedule-progress'
import { StatusBadge } from '@/components/ui/status-badge'
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
  dayScheduledSlots: number
  dayTotalSlots: number
  nightScheduledSlots: number
  nightTotalSlots: number
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
  dayScheduledSlots: 0,
  dayTotalSlots: 0,
  nightScheduledSlots: 0,
  nightTotalSlots: 0,
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

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: 'easeOut' as const },
  }),
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
              .in('role', ['therapist', 'lead']),
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
        let dayScheduledSlots = 0
        let dayTotalSlots = 0
        let nightScheduledSlots = 0
        let nightTotalSlots = 0
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
            const hasStaff = coverageCount > 0
            if (hasStaff) scheduledSlots += 1

            if (shiftType === 'day') {
              dayTotalSlots += 1
              if (hasStaff) dayScheduledSlots += 1
            } else {
              nightTotalSlots += 1
              if (hasStaff) nightScheduledSlots += 1
            }

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
            if (hasStaff) weekBucket.scheduled += 1
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
          dayScheduledSlots,
          dayTotalSlots,
          nightScheduledSlots,
          nightTotalSlots,
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

  return (
    <div className="px-8 py-6 max-w-6xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {getGreeting()}, {data.managerName}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {data.cycleStart} – {data.cycleEnd} cycle
              </span>
              {!loading && unresolvedCoverage > 0 && (
                <StatusBadge variant="error" className="text-[11px]">
                  {unresolvedCoverage} coverage gaps
                </StatusBadge>
              )}
              {!loading && typeof d.pendingApprovals === 'number' && d.pendingApprovals > 0 && (
                <StatusBadge variant="warning" className="text-[11px]">
                  {d.pendingApprovals} pending approvals
                </StatusBadge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => router.push(coverageRoute)}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Open Schedule
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => router.push(publishRoute)}
            >
              <Send className="h-3.5 w-3.5" />
              Publish Schedule
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Coverage Issues',
            value: loading ? '--' : unresolvedCoverage,
            icon: Shield,
            variant: (loading || unresolvedCoverage > 0 ? 'error' : 'success') as
              | 'error'
              | 'success',
            sublabel: loading
              ? 'Loading...'
              : `${d.missingLead} missing lead, ${d.underCoverage} under coverage`,
            route: coverageRoute,
          },
          {
            label: 'Pending Approvals',
            value: d.pendingApprovals,
            icon: FileCheck,
            variant: (typeof d.pendingApprovals === 'number' && d.pendingApprovals > 0
              ? 'warning'
              : 'success') as 'warning' | 'success',
            sublabel: loading ? 'Loading...' : `${d.approvedToday} approved today`,
            route: approvalsRoute,
          },
          {
            label: 'Availability Received',
            value:
              loading ||
              typeof d.activeEmployees !== 'number' ||
              typeof d.therapistsScheduled !== 'number'
                ? '--'
                : `${d.therapistsScheduled}/${d.activeEmployees}`,
            icon: Users,
            variant: 'default' as const,
            sublabel: loading ? 'Loading...' : `${pendingTeamMembers} therapists pending`,
            route: MANAGER_WORKFLOW_LINKS.team,
          },
          {
            label: 'Publish Readiness',
            value: publishReadinessPercent === '--' ? '--' : `${publishReadinessPercent}%`,
            icon: CheckCircle2,
            variant: (typeof publishReadinessPercent === 'number' && publishReadinessPercent >= 75
              ? 'success'
              : 'warning') as 'success' | 'warning',
            sublabel: loading
              ? 'Loading...'
              : `${publishReadyCount}/${publishChecklist.length} checks complete`,
            route: publishRoute,
          },
        ].map((stat, i) => (
          <motion.div key={stat.label} custom={i} variants={fadeUp} initial="hidden" animate="show">
            <StatsCard
              label={stat.label}
              value={stat.value}
              sublabel={stat.sublabel}
              icon={stat.icon}
              variant={stat.variant}
              clickable
              onClick={() => router.push(stat.route)}
            />
          </motion.div>
        ))}
      </div>

      {/* Row 2: Schedule Progress + Coverage Risks */}
      <div className="mb-6 grid grid-cols-3 gap-6">
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="col-span-1"
        >
          <ScheduleProgress
            dayScheduled={loading ? 0 : data.dayScheduledSlots}
            dayTotal={loading ? 0 : data.dayTotalSlots}
            nightScheduled={loading ? 0 : data.nightScheduledSlots}
            nightTotal={loading ? 0 : data.nightTotalSlots}
            totalScheduled={loading ? 0 : data.scheduledSlots}
            totalSlots={loading ? 0 : data.totalSlots}
          />
        </motion.div>

        <motion.div
          custom={5}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="col-span-2 overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--error-text)]" />
              <h2 className="font-heading text-sm font-semibold text-foreground">Coverage Risks</h2>
              {!loading && unresolvedCoverage > 0 && (
                <StatusBadge variant="error" dot={false}>
                  {unresolvedCoverage} issues
                </StatusBadge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-primary"
              onClick={() => router.push(coverageRoute)}
            >
              Fix Coverage <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="divide-y divide-border/50">
            {coverageRisks.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-3.5">
                  {item.severity === 'error' ? (
                    <AlertTriangle className="h-4 w-4 text-[var(--error-text)]" />
                  ) : (
                    <Clock className="h-4 w-4 text-[var(--warning-text)]" />
                  )}
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
                <StatusBadge
                  variant={
                    loading
                      ? 'neutral'
                      : typeof item.value === 'number' && item.value > 0
                        ? item.severity
                        : 'success'
                  }
                  dot={false}
                >
                  {loading ? '--' : String(item.value)}
                </StatusBadge>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Row 3: Approvals + Publish Readiness */}
      <div className="grid grid-cols-3 gap-6">
        <motion.div
          custom={6}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="col-span-1 overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-accent" />
              <h2 className="font-heading text-sm font-semibold text-foreground">Approvals</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-primary"
              onClick={() => router.push(approvalsRoute)}
            >
              Review All <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="divide-y divide-border">
            <div className="px-5 py-3.5">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-sm font-medium text-foreground">Pending requests</p>
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    typeof d.pendingApprovals === 'number' && d.pendingApprovals > 0
                      ? 'text-[var(--warning-text)]'
                      : 'text-foreground'
                  )}
                >
                  {loading ? '--' : d.pendingApprovals}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Shift swap / coverage requests</p>
            </div>
            <div className="px-5 py-3.5">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-sm font-medium text-foreground">Approved today</p>
                <span className="text-sm font-semibold tabular-nums text-[var(--success-text)]">
                  {loading ? '--' : d.approvedToday}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Processed so far today</p>
            </div>
            <div className="px-5 py-3.5">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-sm font-medium text-foreground">Denied today</p>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {loading ? '--' : d.deniedToday}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Processed so far today</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          custom={7}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="col-span-2 overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
        >
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-heading text-sm font-semibold text-foreground">
              Publish Readiness
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Clear these items to publish the cycle safely.
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
        </motion.div>
      </div>
    </div>
  )
}

function ChecklistRow({ label, done, detail }: { label: string; done: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full',
          done ? 'bg-[var(--success)]' : 'border-2 border-border'
        )}
      >
        {done && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
      </div>
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
