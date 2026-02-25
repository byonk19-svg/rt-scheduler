'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { Cycle, ShiftRole, ShiftStatus } from '@/app/schedule/types'
import { buildDateRange, dateKeyFromDate } from '@/lib/schedule-helpers'
import { MAX_SHIFT_COVERAGE_PER_DAY, MIN_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import { createClient } from '@/lib/supabase/client'
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
  shift_type: 'day' | 'night' | null
  is_active: boolean | null
  on_fmla: boolean | null
}

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
  schedule_cycles:
    | { published: boolean }
    | { published: boolean }[]
    | null
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

function buildCycleRoute(path: '/coverage' | '/schedule', cycleId: string | null): string {
  const params = new URLSearchParams({ view: 'week' })
  if (cycleId) params.set('cycle', cycleId)
  return `${path}?${params.toString()}`
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

        if (profile?.role && profile.role !== 'manager') {
          router.replace('/dashboard/staff')
          return
        }

        const managerName = profile.full_name ?? user.user_metadata?.full_name ?? 'Manager'
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

        const [teamProfilesResult, pendingPostsResult, reviewedPostsResult, shiftsResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, shift_type, is_active, on_fmla')
            .in('role', ['therapist', 'staff']),
          supabase
            .from('shift_posts')
            .select('shift_id')
            .eq('status', 'pending'),
          supabase
            .from('shift_posts')
            .select('shift_id, status')
            .in('status', ['approved', 'denied'])
            .gte('created_at', todayStart.toISOString()),
          shiftsQuery,
        ])

        if (teamProfilesResult.error) {
          console.error('Failed to load team profile metrics for dashboard:', teamProfilesResult.error)
        }

        if (pendingPostsResult.error) {
          console.error('Failed to load pending approval posts for dashboard:', pendingPostsResult.error)
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

        const shifts = shiftsResult.error ? [] : ((shiftsResult.data ?? []) as ShiftCoverageRow[])
        const shiftsBySlot = new Map<string, ShiftCoverageRow[]>()

        for (const shift of shifts) {
          const slotKey = `${shift.date}:${shift.shift_type}`
          const rows = shiftsBySlot.get(slotKey) ?? []
          rows.push(shift)
          shiftsBySlot.set(slotKey, rows)
        }

        for (const date of buildDateRange(cycleStartDate, cycleEndDate)) {
          for (const shiftType of ['day', 'night'] as const) {
            const slotKey = `${date}:${shiftType}`
            const slotRows = shiftsBySlot.get(slotKey) ?? []
            const activeRows = slotRows.filter((row) => countsTowardCoverage(row.status))
            const assignedRows = activeRows.filter((row) => Boolean(row.user_id))
            const coverageCount = assignedRows.length
            const leadCount = assignedRows.filter((row) => row.role === 'lead').length

            if (coverageCount === 0) unfilledShifts += 1
            if (leadCount === 0) missingLead += 1
            if (coverageCount < MIN_SHIFT_COVERAGE_PER_DAY) underCoverage += 1
            if (coverageCount > MAX_SHIFT_COVERAGE_PER_DAY) overCoverage += 1
          }
        }

        const pendingPosts = pendingPostsResult.error ? [] : ((pendingPostsResult.data ?? []) as ShiftPostRow[])
        const reviewedPosts = reviewedPostsResult.error ? [] : ((reviewedPostsResult.data ?? []) as ShiftPostRow[])

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
            console.error('Failed to scope approval metrics to published cycles:', publishedLookupError)
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
            : pendingPosts.filter((row) => row.shift_id && publishedShiftIds.has(row.shift_id)).length

        const approvedToday = reviewedPosts.filter(
          (row) =>
            row.status === 'approved' &&
            (publishedShiftIds === null || (row.shift_id !== null && publishedShiftIds.has(row.shift_id)))
        ).length

        const deniedToday = reviewedPosts.filter(
          (row) =>
            row.status === 'denied' &&
            (publishedShiftIds === null || (row.shift_id !== null && publishedShiftIds.has(row.shift_id)))
        ).length

        const teamProfiles = teamProfilesResult.error ? [] : ((teamProfilesResult.data ?? []) as TeamProfileRow[])
        const activeTeamProfiles = teamProfiles.filter((row) => row.is_active !== false)

        const activeEmployees = activeTeamProfiles.length
        const dayShift = activeTeamProfiles.filter((row) => row.shift_type === 'day').length
        const nightShift = activeTeamProfiles.filter((row) => row.shift_type === 'night').length
        const onFmla = activeTeamProfiles.filter((row) => row.on_fmla === true).length

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
          cycleStart: formatCycleDate(cycleStartDate),
          cycleEnd: formatCycleDate(cycleEndDate),
          managerName,
          activeCycleId: activeCycle?.id ?? null,
        })
      } catch (error) {
        console.error('Failed to load manager dashboard data:', error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
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
        cycleStart: '—',
        cycleEnd: '—',
      }
    : data

  const coverageRoute = buildCycleRoute('/coverage', data.activeCycleId)
  const publishRoute = buildCycleRoute('/coverage', data.activeCycleId)
  const approvalsRoute = MANAGER_WORKFLOW_LINKS.approvals
  const teamRoute = MANAGER_WORKFLOW_LINKS.team

  const approvalsClear = !loading && data.pendingApprovals === 0
  const coverageHasIssues = !loading && data.underCoverage > 0
  const leadHasIssues = !loading && data.missingLead > 0

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px' }}>
      <div className="fade-up" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Manager Dashboard
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              Welcome, {d.managerName}. Build coverage first, then publish confidently.
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '7px 14px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="11" rx="2" stroke="#d97706" strokeWidth="1.5" />
              <path d="M5 1v2M9 1v2M1 6h12" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>
              Cycle: {d.cycleStart} – {d.cycleEnd}
            </span>
          </div>
        </div>
      </div>

      <div
        className="fade-up"
        style={{
          animationDelay: '0.05s',
          background: '#fff',
          border: '1.5px solid #fde68a',
          borderLeft: '4px solid #d97706',
          borderRadius: 10,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 20, flex: 1, flexWrap: 'wrap' }}>
          <Stat label="Unfilled shifts" value={d.unfilledShifts} color="#dc2626" />
          <div style={{ width: 1, background: '#f1f5f9', alignSelf: 'stretch' }} />
          <Stat label="Missing lead" value={d.missingLead} color="#dc2626" />
          <div style={{ width: 1, background: '#f1f5f9', alignSelf: 'stretch' }} />
          <Stat label="Under coverage" value={d.underCoverage} color="#c2410c" />
          <div style={{ width: 1, background: '#f1f5f9', alignSelf: 'stretch' }} />
          <Stat label="Pending approvals" value={d.pendingApprovals} color="#059669" />
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <AmberButton onClick={() => router.push(coverageRoute)}>Fix coverage</AmberButton>
          <GhostButton onClick={() => router.push(approvalsRoute)}>Review approvals</GhostButton>
          <GhostButton onClick={() => router.push(publishRoute)}>Go to publish</GhostButton>
        </div>
      </div>

      <div
        className="fade-up"
        style={{ animationDelay: '0.1s', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}
      >
        <Card>
          <CardHeader icon="📋" title="Coverage" subtitle="Resolve gaps before publishing" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '14px 0' }}>
            <IssueRow label="Missing lead" value={d.missingLead} type="error" />
            <IssueRow label="Under coverage" value={d.underCoverage} type="warn" />
            <IssueRow label="Over coverage" value={d.overCoverage} type="ok" />
          </div>
          <AmberButton full onClick={() => router.push(coverageRoute)}>
            Open coverage
          </AmberButton>
        </Card>

        <Card>
          <CardHeader icon="🚀" title="Publish" subtitle="Checklist must be clear to publish" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '14px 0' }}>
            <CheckRow
              label="Approvals"
              status={approvalsClear ? 'ok' : 'error'}
              detail={loading ? '—' : approvalsClear ? 'clear' : `${data.pendingApprovals} pending`}
            />
            <CheckRow
              label="Coverage"
              status={coverageHasIssues ? 'error' : 'ok'}
              detail={loading ? '—' : coverageHasIssues ? `${data.underCoverage} issues` : 'clear'}
            />
            <CheckRow
              label="Lead"
              status={leadHasIssues ? 'error' : 'ok'}
              detail={loading ? '—' : leadHasIssues ? `${data.missingLead} shifts missing lead` : 'clear'}
            />
          </div>
          <AmberButton full onClick={() => router.push(publishRoute)}>
            Resolve blockers
          </AmberButton>
        </Card>

        <Card>
          <CardHeader icon="✅" title="Approvals" subtitle="Swap and pickup requests" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '14px 0' }}>
            <CheckRow
              label="Pending"
              status={approvalsClear ? 'ok' : 'error'}
              detail={loading ? '—' : `${data.pendingApprovals} waiting`}
            />
            <CheckRow label="Approved today" status="ok" detail={String(d.approvedToday)} />
            <CheckRow label="Denied today" status="ok" detail={String(d.deniedToday)} />
          </div>
          <GhostButton full onClick={() => router.push(approvalsRoute)}>
            Open approvals
          </GhostButton>
        </Card>
      </div>

      <div
        className="fade-up"
        style={{
          animationDelay: '0.15s',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: '18px 20px',
          marginBottom: 24,
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Quick actions</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'Assign coverage', route: coverageRoute, active: true },
            { label: 'Publish cycle', route: publishRoute, active: false },
            { label: 'Review approvals', route: approvalsRoute, active: false },
            { label: 'View team', route: teamRoute, active: false },
          ].map(({ label, route, active }) => (
            <button
              key={label}
              onClick={() => router.push(route)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '7px 16px',
                borderRadius: 7,
                border: `1px solid ${active ? '#d97706' : '#e5e7eb'}`,
                background: active ? '#fffbeb' : '#fff',
                color: active ? '#b45309' : '#374151',
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="fade-up"
        style={{ animationDelay: '0.2s', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 20px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Team summary</p>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Directory management on the Team page.</p>
          </div>
          <GhostButton onClick={() => router.push(teamRoute)}>Manage team</GhostButton>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { label: 'Active employees', value: d.activeEmployees, icon: '👥' },
            { label: 'Day shift', value: d.dayShift, icon: '☀️' },
            { label: 'Night shift', value: d.nightShift, icon: '🌙' },
            { label: 'On FMLA', value: d.onFmla, icon: '📋' },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#0f172a',
                  lineHeight: 1,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                {value}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  )
}

function CardHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: '#fffbeb',
          border: '1px solid #fde68a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{title}</p>
        <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{subtitle}</p>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          fontSize: 22,
          fontWeight: 800,
          color,
          lineHeight: 1,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

function IssueRow({ label, value, type }: { label: string; value: number | string; type: 'error' | 'warn' | 'ok' }) {
  const color = type === 'error' ? '#dc2626' : type === 'warn' ? '#c2410c' : '#059669'
  const bg = type === 'error' ? '#fee2e2' : type === 'warn' ? '#ffedd5' : '#ecfdf5'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 10px',
        background: '#f8fafc',
        borderRadius: 7,
      }}
    >
      <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color, background: bg, padding: '1px 8px', borderRadius: 20 }}>
        {value}
      </span>
    </div>
  )
}

function CheckRow({ label, status, detail }: { label: string; status: 'ok' | 'error'; detail: string }) {
  const isOk = status === 'ok'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#f8fafc', borderRadius: 7 }}>
      <span style={{ fontSize: 13, flexShrink: 0 }}>{isOk ? '✅' : '❌'}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', minWidth: 70 }}>{label}</span>
      <span
        style={{
          fontSize: 11,
          color: isOk ? '#059669' : '#dc2626',
          fontWeight: 600,
          marginLeft: 'auto',
          textAlign: 'right' as const,
        }}
      >
        {detail}
      </span>
    </div>
  )
}

function AmberButton({ children, onClick, full = false }: { children: React.ReactNode; onClick?: () => void; full?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: '7px 16px',
        borderRadius: 7,
        border: 'none',
        background: '#d97706',
        color: '#fff',
        cursor: 'pointer',
        width: full ? '100%' : 'auto',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {children}
    </button>
  )
}

function GhostButton({ children, onClick, full = false }: { children: React.ReactNode; onClick?: () => void; full?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: '7px 16px',
        borderRadius: 7,
        border: '1px solid #e5e7eb',
        background: '#fff',
        color: '#374151',
        cursor: 'pointer',
        width: full ? '100%' : 'auto',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {children}
    </button>
  )
}
