import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeftRight, CalendarDays, CheckCircle2, Clock } from 'lucide-react'

import { FeedbackToast } from '@/components/feedback-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'

type StaffDashboardSearchParams = {
  success?: string | string[]
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getStaffDashboardFeedback(
  params?: StaffDashboardSearchParams
): { message: string; variant: 'success' } | null {
  const success = getSearchParam(params?.success)
  if (success === 'signed_in') return { message: 'Signed in successfully.', variant: 'success' }
  if (success === 'access_requested')
    return { message: 'Access request submitted and signed in.', variant: 'success' }
  return null
}

export default async function StaffDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<StaffDashboardSearchParams>
}) {
  const supabase = await createClient()
  const params = searchParams ? await searchParams : undefined
  const feedback = getStaffDashboardFeedback(params)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  const isManager = can(parseRole(profile?.role), 'access_manager_ui')
  if (isManager) {
    redirect('/dashboard/manager')
  }

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Staff member'

  // Fetch live metrics --------------------------------------------------------
  const today = new Date().toISOString().split('T')[0]

  const { data: cycles } = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date')
    .gte('end_date', today)
    .order('start_date', { ascending: true })
    .limit(2)

  const activeCycle =
    (cycles ?? []).find((c) => c.start_date <= today && c.end_date >= today) ??
    (cycles ?? [])[0] ??
    null

  const [upcomingShiftsResult, overrideCountResult, pendingPostCountResult] = await Promise.all([
    activeCycle
      ? supabase
          .from('shifts')
          .select('id, date, shift_type, status, role')
          .eq('user_id', user.id)
          .eq('cycle_id', activeCycle.id)
          .gte('date', today)
          .in('status', ['scheduled', 'on_call'])
          .order('date', { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] }),
    activeCycle
      ? supabase
          .from('availability_overrides')
          .select('id', { head: true, count: 'exact' })
          .eq('therapist_id', user.id)
          .eq('cycle_id', activeCycle.id)
      : Promise.resolve({ count: 0 }),
    supabase
      .from('shift_posts')
      .select('id', { head: true, count: 'exact' })
      .eq('posted_by', user.id)
      .eq('status', 'pending'),
  ])

  const upcomingShifts = upcomingShiftsResult.data ?? []
  const upcomingCount = upcomingShifts.length
  const nextShift = upcomingShifts[0] ?? null
  const nextShiftLabel = nextShift
    ? new Date(`${nextShift.date}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null
  const availabilitySubmitted = (overrideCountResult.count ?? 0) > 0
  const pendingPostCount = pendingPostCountResult.count ?? 0

  // Upcoming shift roster - who else is scheduled on the next 3 shifts --------
  type RosterShift = {
    user_id: string | null
    date: string
    shift_type: string | null
    role: string | null
  }
  const rosterDates = upcomingShifts.slice(0, 3).map((s) => s.date)
  const rosterRawShifts: RosterShift[] =
    rosterDates.length > 0 && activeCycle
      ? (((
          await supabase
            .from('shifts')
            .select('user_id, date, shift_type, role')
            .eq('cycle_id', activeCycle.id)
            .in('date', rosterDates)
            .in('status', ['scheduled', 'on_call'])
            .neq('user_id', user.id)
        ).data as RosterShift[] | null) ?? [])
      : []

  const rosterUserIds = [
    ...new Set(rosterRawShifts.map((s) => s.user_id).filter((id): id is string => Boolean(id))),
  ]
  const rosterNameById = new Map<string, string>()
  if (rosterUserIds.length > 0) {
    const { data: rosterProfiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', rosterUserIds)
    for (const p of rosterProfiles ?? []) {
      if (p.id && p.full_name) rosterNameById.set(p.id, p.full_name)
    }
  }

  type ShiftColleague = { name: string; isLead: boolean }
  type UpcomingShiftRoster = {
    date: string
    label: string
    shiftType: string
    myRole: string
    colleagues: ShiftColleague[]
  }
  const upcomingRoster: UpcomingShiftRoster[] = upcomingShifts.slice(0, 3).map((myShift) => {
    const colleagues = rosterRawShifts
      .filter((s) => s.date === myShift.date && s.shift_type === myShift.shift_type)
      .map((s) => ({
        name: s.user_id ? (rosterNameById.get(s.user_id) ?? '?') : '?',
        isLead: s.role === 'lead',
      }))
      .sort((a, b) => (b.isLead ? 1 : 0) - (a.isLead ? 1 : 0))
    return {
      date: myShift.date,
      label: new Date(`${myShift.date}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      shiftType: myShift.shift_type ?? 'day',
      myRole: myShift.role ?? 'staff',
      colleagues,
    }
  })
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      {/* Header */}
      <PageHeader
        title="Staff Home"
        subtitle={`Welcome, ${fullName}. Your self-service tools are prioritized below.`}
        badge={
          <>
            <Badge variant="secondary">Role: therapist</Badge>
            <Badge variant="outline">Team: Respiratory Therapy</Badge>
          </>
        }
      />

      {/* Metrics banner */}
      {activeCycle && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(6,103,169,0.06),0_4px_12px_rgba(6,103,169,0.03)]">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {activeCycle.label}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {/* Upcoming shifts */}
            <div className="flex flex-col items-center gap-1 rounded-lg bg-muted p-3 text-center">
              <CalendarDays className="h-4 w-4 text-primary" />
              <p className="text-xl font-bold text-foreground">{upcomingCount}</p>
              <p className="text-xs text-muted-foreground">Upcoming shifts</p>
            </div>

            {/* Next shift */}
            <div className="flex flex-col items-center gap-1 rounded-lg bg-muted p-3 text-center">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">{nextShiftLabel ?? 'None'}</p>
              <p className="text-xs text-muted-foreground">Next shift</p>
            </div>

            {/* Availability */}
            <div className="flex flex-col items-center gap-1 rounded-lg bg-muted p-3 text-center">
              <CheckCircle2
                className={cn(
                  'h-4 w-4',
                  availabilitySubmitted
                    ? 'text-[var(--success-text)]'
                    : 'text-[var(--warning-text)]'
                )}
              />
              <p
                className={cn(
                  'text-xs font-semibold',
                  availabilitySubmitted
                    ? 'text-[var(--success-text)]'
                    : 'text-[var(--warning-text)]'
                )}
              >
                {availabilitySubmitted ? 'Submitted' : 'Not submitted'}
              </p>
              <p className="text-xs text-muted-foreground">Future availability</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-foreground">Before schedule is published</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use Future Availability to submit upcoming cycle requests.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link href="/availability">Open future availability</Link>
          </Button>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-foreground">After schedule is published</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use Shift Swaps to swap or pick up already published shifts.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link href="/shift-board">Open shift swaps</Link>
          </Button>
        </div>
      </div>

      {/* Upcoming shift roster */}
      {upcomingRoster.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(6,103,169,0.06),0_4px_12px_rgba(6,103,169,0.03)]">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Upcoming shifts
          </p>
          <div className="divide-y divide-border">
            {upcomingRoster.map((shift) => (
              <div key={shift.date} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-[96px] shrink-0">
                  <p className="text-xs font-semibold text-foreground">{shift.label}</p>
                  <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                    {shift.shiftType} shift
                  </p>
                  {shift.myRole === 'lead' && (
                    <span
                      className="mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        borderColor: 'var(--warning-border)',
                        backgroundColor: 'var(--warning-subtle)',
                        color: 'var(--warning-text)',
                      }}
                    >
                      Lead
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {shift.colleagues.length > 0 ? (
                    shift.colleagues.map((c, i) => (
                      <span
                        key={i}
                        className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                        style={
                          c.isLead
                            ? {
                                borderColor: 'var(--warning-border)',
                                backgroundColor: 'var(--warning-subtle)',
                                color: 'var(--warning-text)',
                              }
                            : {
                                borderColor: 'var(--border)',
                                backgroundColor: 'var(--muted)',
                                color: 'var(--muted-foreground)',
                              }
                        }
                      >
                        {c.isLead ? 'Lead: ' : ''}
                        {c.name.split(' ')[0]}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No colleagues assigned yet.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nav cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <NavCard
          icon={<CalendarDays className="h-5 w-5 text-primary" />}
          title="My Schedule"
          description={
            upcomingCount > 0
              ? `${String(upcomingCount)} upcoming shift${upcomingCount === 1 ? '' : 's'} this cycle.`
              : 'No upcoming shifts scheduled yet.'
          }
          href="/schedule"
          cta="Open schedule"
        />
        <NavCard
          icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
          title="Future Availability"
          description={
            activeCycle
              ? availabilitySubmitted
                ? `Submitted for ${activeCycle.label}.`
                : 'Not submitted for this upcoming cycle yet.'
              : 'Submit days you cannot work in upcoming cycles before publish.'
          }
          href="/availability"
          cta="Open future availability"
        />
        <NavCard
          icon={<ArrowLeftRight className="h-5 w-5 text-primary" />}
          title="Shift Swaps (Published)"
          description={
            pendingPostCount > 0
              ? `${String(pendingPostCount)} pending request${pendingPostCount === 1 ? '' : 's'}.`
              : 'Use this for swaps or pickups in published schedules.'
          }
          href="/shift-board"
          cta="Open shift swaps"
        />
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NavCard({
  icon,
  title,
  description,
  href,
  cta,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  cta: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(6,103,169,0.10)]">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="app-section-title">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  )
}
